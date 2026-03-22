import json
from typing import Any

from flask import current_app

from .redis_client import redis_cache


def publish_metric_ingest_event(event: dict[str, Any], key: str | None = None) -> dict[str, str]:
    del key  # Reserved for compatibility with older call sites.

    payload = json.dumps(event, ensure_ascii=False)
    message_id = redis_cache.get_client().xadd(
        current_app.config["METRICS_STREAM_KEY"],
        {"event": payload},
    )
    return {"stream": current_app.config["METRICS_STREAM_KEY"], "id": message_id}
