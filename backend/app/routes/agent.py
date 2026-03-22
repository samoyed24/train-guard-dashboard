from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request

from ..extensions import db
from ..kafka_client import publish_metric_ingest_event
from ..models import ConfigVersion, MetricRecord, TrainingRun
from ..redis_client import redis_get_json, redis_set_json
from ..security import project_auth_required

agent_bp = Blueprint("agent", __name__, url_prefix="/api")


@agent_bp.post("/agent/config/fetch")
@project_auth_required
def fetch_config():
    project = g.project
    cache_key = f"config:active:{project.app_id}"
    cached = redis_get_json(cache_key)
    if cached is not None:
        return jsonify({"code": 0, "data": {"config": cached, "from_cache": True}})

    active = (
        ConfigVersion.query.filter_by(app_id=project.id, is_active=True)
        .order_by(ConfigVersion.id.desc())
        .first()
    )
    if not active:
        return jsonify({"message": "No active config"}), 404

    redis_set_json(cache_key, active.content, ttl_seconds=3600)
    return jsonify({"code": 0, "data": {"config": active.content, "from_cache": False}})


@agent_bp.post("/metrics/ingest")
@project_auth_required
def ingest_metrics():
    project = g.project
    payload = request.get_json() or {}
    if not isinstance(payload, dict):
        return jsonify({"message": "payload must be JSON object"}), 400

    train_id = payload.get("train_id") or "default"
    now = datetime.now(timezone.utc)

    run = TrainingRun.query.filter_by(app_id=project.id, train_id=train_id).first()
    if not run:
        run = TrainingRun(app_id=project.id, train_id=train_id, first_seen_at=now, last_seen_at=now)
        db.session.add(run)
        db.session.flush()
    else:
        run.last_seen_at = now

    record = MetricRecord(run_id=run.id, payload=payload)
    db.session.add(record)

    db.session.flush()

    event = {
        "project_pk": project.id,
        "project_id": project.app_id,
        "run_id": run.id,
        "record_id": record.id,
        "train_id": run.train_id,
        "received_at": now.isoformat(),
        "payload": payload,
    }

    try:
        delivery = publish_metric_ingest_event(event=event, key=f"{project.app_id}:{run.train_id}")
    except Exception as exc:
        db.session.rollback()
        return jsonify({"message": "failed to publish metric event", "detail": str(exc)}), 503

    db.session.commit()

    return jsonify(
        {
            "code": 0,
            "message": "ok",
            "run_id": run.id,
            "record_id": record.id,
            "queued": True,
            "kafka": delivery,
        }
    ), 202
