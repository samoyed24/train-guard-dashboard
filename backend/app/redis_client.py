import json
from dataclasses import dataclass
from typing import Any

from flask import current_app
from redis import Redis


@dataclass(frozen=True)
class RedisKeys:
    REGISTER_EMAIL_CODE: str = "auth:register:email_code:{email}"
    REGISTER_EMAIL_CODE_COOLDOWN: str = "auth:register:email_code:cooldown:{email}"
    AUTH_BLACKLIST: str = "auth:blacklist:{jti}"
    ACTIVE_CONFIG: str = "config:active:{project_id}"

    def register_email_code(self, email: str) -> str:
        return self.REGISTER_EMAIL_CODE.format(email=email)

    def register_email_code_cooldown(self, email: str) -> str:
        return self.REGISTER_EMAIL_CODE_COOLDOWN.format(email=email)

    def auth_blacklist(self, jti: str) -> str:
        return self.AUTH_BLACKLIST.format(jti=jti)

    def active_config(self, project_id: str) -> str:
        return self.ACTIVE_CONFIG.format(project_id=project_id)


class RedisCache:
    def __init__(self) -> None:
        self._client: Redis | None = None

    def get_client(self) -> Redis:
        if self._client is None:
            self._client = Redis.from_url(current_app.config["REDIS_URL"], decode_responses=True)
        return self._client

    def get(self, key: str):
        return self.get_client().get(key)

    def setex(self, key: str, ttl_seconds: int, value: str):
        return self.get_client().setex(key, ttl_seconds, value)

    def delete(self, key: str):
        return self.get_client().delete(key)

    def set_json(self, key: str, value: dict[str, Any], ttl_seconds: int = 3600):
        return self.setex(key, ttl_seconds, json.dumps(value, ensure_ascii=False))

    def get_json(self, key: str):
        raw = self.get(key)
        if not raw:
            return None
        return json.loads(raw)

    def get_register_email_code(self, email: str):
        return self.get(redis_keys.register_email_code(email))

    def set_register_email_code(self, email: str, ttl_seconds: int, code: str):
        return self.setex(redis_keys.register_email_code(email), ttl_seconds, code)

    def delete_register_email_code(self, email: str):
        return self.delete(redis_keys.register_email_code(email))

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

    def set_active_config(self, project_id: str, value: dict[str, Any], ttl_seconds: int = 3600):
        return self.set_json(redis_keys.active_config(project_id), value, ttl_seconds=ttl_seconds)

    def delete_active_config(self, project_id: str):
        return self.delete(redis_keys.active_config(project_id))


redis_keys = RedisKeys()
redis_cache = RedisCache()
