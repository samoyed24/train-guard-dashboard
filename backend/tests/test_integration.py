from app.extensions import db
from app.models import ConfigVersion, MetricRecord, MetricSeriesPoint, TrainingRun

from tests.test_support import BackendTestCase


class AuthFlowIntegrationTestCase(BackendTestCase):
    def test_register_login_and_logout_flow(self) -> None:
        email = "alice@example.com"

        send_code = self.client.post("/api/auth/register/email-code", json={"email": email})
        self.assertEqual(send_code.status_code, 200)
        self.assertEqual(send_code.json, {"message": "ok"})
        self.assertEqual(len(self.sent_emails), 1)

        code = self.redis.get(f"auth:register:email_code:{email}")
        register = self.client.post(
            "/api/auth/register",
            json={
                "email": email,
                "name": "Alice",
                "password": "secret123",
                "verification_code": code,
            },
        )
        self.assertEqual(register.status_code, 201)

        login = self.client.post("/api/auth/login", json={"email": email, "password": "secret123"})
        self.assertEqual(login.status_code, 200)
        token = login.json["token"]

        me = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json["email"], email)

        logout = self.client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(logout.status_code, 200)

        revoked = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(revoked.status_code, 401)
        self.assertEqual(revoked.json["message"], "Token revoked")


class ProjectAccessKeyAndAgentIntegrationTestCase(BackendTestCase):
    def test_project_config_access_key_and_ingest_flow(self) -> None:
        user = self.create_user()
        auth_headers = self.auth_headers(user.id)

        project_resp = self.client.post("/api/projects", headers=auth_headers, json={"name": "Forecast Engine"})
        self.assertEqual(project_resp.status_code, 201)
        project_pk = project_resp.json["id"]
        project_id = project_resp.json["project_id"]
        self.assertIn("project_secret", project_resp.json)

        config_payload = {
            "content": {
                "server": {
                    "heartbeat_interval_seconds": 12,
                    "timeout": 9,
                    "retry_count": 4,
                },
                "agent": {
                    "upload_frequency": "step",
                    "upload_interval": 5,
                },
            }
        }
        upsert = self.client.put(f"/api/projects/{project_pk}/config", headers=auth_headers, json=config_payload)
        self.assertEqual(upsert.status_code, 200)
        self.assertTrue(upsert.json["is_active"])

        create_ak = self.client.post("/api/access-keys", headers=auth_headers, json={"name": "Collector"})
        self.assertEqual(create_ak.status_code, 201)
        access_headers = {
            "X-Access-Key-Id": create_ak.json["access_key_id"],
            "X-Secret-Key": create_ak.json["secret_key"],
            "X-Project-Id": project_id,
        }

        fetch_config = self.client.get("/api/agent/config", headers=access_headers)
        self.assertEqual(fetch_config.status_code, 200)
        fetched = fetch_config.json["data"]["config"]
        self.assertEqual(fetched["server"]["heartbeat_interval_seconds"], 12)
        self.assertEqual(
            fetched["server"]["url"],
            "https://api.example.test/api/metrics/ingest",
        )

        ingest = self.client.post(
            "/api/metrics/ingest",
            headers=access_headers,
            json={
                "project_id": project_id,
                "train_id": "run-001",
                "step": 10,
                "epoch": 1,
                "loss": 0.123,
                "lr": 0.0001,
            },
        )
        self.assertEqual(ingest.status_code, 202)
        self.assertTrue(ingest.json["queued"])
        self.assertEqual(len(self.published_events), 1)
        self.assertEqual(self.published_events[0]["event"]["project_id"], project_id)

        runs = self.client.get(f"/api/projects/{project_pk}/runs", headers=auth_headers)
        self.assertEqual(runs.status_code, 200)
        self.assertEqual(len(runs.json), 1)

        run_id = runs.json[0]["id"]
        metrics = self.client.get(f"/api/projects/{project_pk}/runs/{run_id}/metrics?limit=10", headers=auth_headers)
        self.assertEqual(metrics.status_code, 200)
        self.assertEqual(len(metrics.json), 1)
        self.assertEqual(metrics.json[0]["payload"]["loss"], 0.123)

    def test_dashboard_overview_returns_summary_recent_runs_and_featured_points(self) -> None:
        user = self.create_user()
        project = self.create_project_record(user.id, name="Vision Pipeline")

        with self.app.app_context():
            config = ConfigVersion(
                app_id=project.id,
                version=1,
                content={
                    "server": {"heartbeat_interval_seconds": 10, "timeout": 8, "retry_count": 2},
                    "agent": {"upload_frequency": "epoch", "upload_interval": 1},
                },
                is_active=True,
                published_by=user.id,
            )
            db.session.add(config)
            db.session.flush()

            run = TrainingRun(app_id=project.id, train_id="run-dashboard")
            db.session.add(run)
            db.session.flush()

            record = MetricRecord(run_id=run.id, payload={"train_id": run.train_id, "loss": 0.42, "step": 1})
            point = MetricSeriesPoint(run_id=run.id, metric_name="loss", metric_value=0.42, step=1, epoch=1)
            db.session.add(record)
            db.session.add(point)
            db.session.commit()

            run_id = run.id

        overview = self.client.get(
            f"/api/dashboard/overview?featured_run_id={run_id}&project_rank_limit=5&recent_limit=5&pulse_limit=20",
            headers=self.auth_headers(user.id),
        )
        self.assertEqual(overview.status_code, 200)

        payload = overview.json
        self.assertEqual(payload["summary"]["project_count"], 1)
        self.assertEqual(payload["summary"]["run_count"], 1)
        self.assertEqual(len(payload["recent_runs"]), 1)
        self.assertEqual(payload["project_run_stats"][0]["project_id"], project.app_id)
        self.assertEqual(payload["featured"]["run"]["id"], run_id)
        self.assertEqual(payload["featured"]["selected_metric"], "loss")
        self.assertEqual(payload["featured"]["points"][0]["value"], 0.42)
