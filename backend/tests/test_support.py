import os
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy import JSON

from app import create_app
from app.extensions import db
from app.models import AccessKey, Application, ConfigVersion, MetricRecord, User
from app.redis_client import redis_keys
from app.routes.auth import register_email_code_key
from app.security import generate_token, hash_password


# SQLite does not support PostgreSQL JSONB directly, so tests swap these columns to generic JSON.
ConfigVersion.__table__.c.content.type = JSON()
MetricRecord.__table__.c.payload.type = JSON()


class FakeRedisStore:
    def __init__(self) -> None:
        self.data: dict[str, str] = {}

    def get(self, key: str):
        return self.data.get(key)

    def setex(self, key: str, ttl_seconds: int, value: str):
        self.data[key] = value
        return True

    def delete(self, key: str):
        existed = key in self.data
        self.data.pop(key, None)
        return 1 if existed else 0

    def set_json(self, key: str, value: dict, ttl_seconds: int = 3600):
        import json

        self.data[key] = json.dumps(value, ensure_ascii=False)
        return True

    def get_json(self, key: str):
        import json

        raw = self.data.get(key)
        if not raw:
            return None
        return json.loads(raw)

    def get_register_email_code(self, email: str):
        return self.get(register_email_code_key(email))

    def set_register_email_code(self, email: str, ttl_seconds: int, code: str):
        return self.setex(register_email_code_key(email), ttl_seconds, code)

    def delete_register_email_code(self, email: str):
        return self.delete(register_email_code_key(email))

    def get_register_email_code_cooldown(self, email: str):
        return self.get(redis_keys.register_email_code_cooldown(email))

    def set_register_email_code_cooldown(self, email: str, ttl_seconds: int, value: str = "1"):
        return self.setex(redis_keys.register_email_code_cooldown(email), ttl_seconds, value)

    def get_blacklisted_token(self, jti: str):
        return self.get(redis_keys.auth_blacklist(jti))

    def set_blacklisted_token(self, jti: str, ttl_seconds: int):
        return self.setex(redis_keys.auth_blacklist(jti), ttl_seconds, "1")

    def get_active_config(self, project_id: str):
        return self.get_json(redis_keys.active_config(project_id))

    def set_active_config(self, project_id: str, value: dict, ttl_seconds: int = 3600):
        return self.set_json(redis_keys.active_config(project_id), value, ttl_seconds=ttl_seconds)

    def delete_active_config(self, project_id: str):
        return self.delete(redis_keys.active_config(project_id))


class BackendTestCase(unittest.TestCase):
    def setUp(self) -> None:
        fd, self.db_path = tempfile.mkstemp(prefix="train-guard-test-", suffix=".sqlite3")
        os.close(fd)

        self.redis = FakeRedisStore()
        self.sent_emails: list[dict[str, str]] = []
        self.published_events: list[dict] = []

        self.app = create_app(
            {
                "TESTING": True,
                "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.db_path}",
                "SQLALCHEMY_ENGINE_OPTIONS": {"connect_args": {"check_same_thread": False}},
                "SECRET_KEY": "test-secret",
                "PUBLIC_API_BASE_URL": "https://api.example.test",
            }
        )
        self.client = self.app.test_client()

        self.patches = [
            patch("app.routes.auth.send_email", self.fake_send_email),
            patch("app.routes.auth.redis_cache", self.redis),
            patch("app.security.redis_cache", self.redis),
            patch("app.routes.agent.redis_cache", self.redis),
            patch("app.routes.apps.redis_cache", self.redis),
            patch("app.routes.agent.publish_metric_ingest_event", self.fake_publish_metric_ingest_event),
            patch("app.routes.apps.backfill_metric_series_for_run", lambda run_id: None),
            patch("app.routes.dashboard.backfill_metric_series_for_run", lambda run_id: None),
        ]

        for item in self.patches:
            item.start()

        with self.app.app_context():
            db.create_all()

    def tearDown(self) -> None:
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

        for item in reversed(self.patches):
            item.stop()

        if os.path.exists(self.db_path):
            os.remove(self.db_path)

    def fake_send_email(self, to_email: str, subject: str, body: str) -> None:
        self.sent_emails.append({"to": to_email, "subject": subject, "body": body})

    def fake_publish_metric_ingest_event(self, event: dict, key: str | None = None):
        payload = {"event": event, "key": key}
        self.published_events.append(payload)
        return {"stream": "train-guard.metrics.ingest", "id": str(len(self.published_events))}

    def create_user(self, email: str = "alice@example.com", name: str = "Alice", password: str = "secret123"):
        with self.app.app_context():
            user = User(email=email, name=name, password_hash=hash_password(password))
            db.session.add(user)
            db.session.commit()
            return SimpleNamespace(id=user.id, email=user.email, name=user.name)

    def issue_token(self, user_id: int) -> str:
        with self.app.app_context():
            return generate_token(user_id)

    def auth_headers(self, user_id: int) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.issue_token(user_id)}"}

    def create_project_record(self, user_id: int, name: str = "Demo Project"):
        with self.app.app_context():
            project = Application(
                name=name,
                app_id="project_demo_001",
                app_secret_hash=hash_password("project-secret"),
                created_by=user_id,
            )
            db.session.add(project)
            db.session.commit()
            return SimpleNamespace(id=project.id, name=project.name, app_id=project.app_id)

    def create_access_key_record(self, user_id: int, name: str = "CLI Key"):
        with self.app.app_context():
            access_key = AccessKey(
                user_id=user_id,
                name=name,
                access_key_id="ak_demo_001",
                secret_key_hash=hash_password("sk-demo-secret"),
            )
            db.session.add(access_key)
            db.session.commit()
            return SimpleNamespace(id=access_key.id, name=access_key.name, access_key_id=access_key.access_key_id)

    def access_key_headers(self, project_id: str = "project_demo_001") -> dict[str, str]:
        return {
            "X-Access-Key-Id": "ak_demo_001",
            "X-Secret-Key": "sk-demo-secret",
            "X-Project-Id": project_id,
        }

    def seed_auth_code(self, email: str, code: str = "123456") -> None:
        self.redis.setex(register_email_code_key(email), 300, code)
