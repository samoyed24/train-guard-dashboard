import json

from flask import current_app
from redis import Redis

_client = None


def get_redis() -> Redis:
    global _client
    if _client is None:
        _client = Redis.from_url(current_app.config["REDIS_URL"], decode_responses=True)
    return _client


def redis_get(key: str):
    return get_redis().get(key)


def redis_setex(key: str, ttl_seconds: int, value: str):
    return get_redis().setex(key, ttl_seconds, value)


def redis_delete(key: str):
    return get_redis().delete(key)


def redis_set_json(key: str, value: dict, ttl_seconds: int = 3600):
    return redis_setex(key, ttl_seconds, json.dumps(value, ensure_ascii=False))


def redis_get_json(key: str):
    raw = redis_get(key)
    if not raw:
        return None
    return json.loads(raw)
