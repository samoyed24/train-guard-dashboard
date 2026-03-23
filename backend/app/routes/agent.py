from copy import deepcopy
from datetime import datetime, timezone

from flask import Blueprint, current_app, g, jsonify, request

from ..extensions import db
from ..metrics_queue import publish_metric_ingest_event
from ..models import Application, ConfigVersion, MetricRecord, TrainingRun
from ..redis_client import redis_cache
from ..security import access_key_auth_required

agent_bp = Blueprint("agent", __name__, url_prefix="/api")


def _resolve_project():
    project_id = request.headers.get("X-Project-Id")
    project_id = (project_id or "").strip()
    if not project_id:
        return None

    return Application.query.filter_by(
        app_id=project_id,
        created_by=g.access_key_user.id,
        is_active=True,
    ).first()


def _build_public_api_base_url() -> str:
    configured = (current_app.config.get("PUBLIC_API_BASE_URL") or "").strip()
    if configured:
        return configured.rstrip("/")
    return request.host_url.rstrip("/")


def _build_ingest_url(project: Application) -> str:
    base_url = _build_public_api_base_url()
    return f"{base_url}/api/metrics/ingest"


def _hydrate_config(content: dict, project: Application) -> dict:
    hydrated = deepcopy(content)
    server = hydrated.setdefault("server", {})
    server["url"] = _build_ingest_url(project)
    return hydrated


@agent_bp.get("/agent/config")
@access_key_auth_required
def fetch_config():
    project = _resolve_project()
    if not project:
        return jsonify({"message": "Project not found"}), 404

    cached = redis_cache.get_active_config(project.app_id)
    if cached is not None:
        hydrated = _hydrate_config(cached, project)
        return jsonify({"code": 0, "data": {"config": hydrated, "from_cache": True}})

    active = (
        ConfigVersion.query.filter_by(app_id=project.id, is_active=True)
        .order_by(ConfigVersion.id.desc())
        .first()
    )
    if not active:
        return jsonify({"message": "No active config"}), 404

    redis_cache.set_active_config(project.app_id, active.content, ttl_seconds=3600)
    hydrated = _hydrate_config(active.content, project)
    return jsonify({"code": 0, "data": {"config": hydrated, "from_cache": False}})


@agent_bp.post("/metrics/ingest")
@access_key_auth_required
def ingest_metrics():
    project = _resolve_project()
    if not project:
        return jsonify({"message": "Project not found"}), 404

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

    db.session.commit()

    try:
        delivery = publish_metric_ingest_event(event=event, key=f"{project.app_id}:{run.train_id}")
    except Exception as exc:
        current_app.logger.warning("failed to enqueue metric event after db commit: %s", exc)
        return jsonify(
            {
                "code": 0,
                "message": "ok",
                "run_id": run.id,
                "record_id": record.id,
                "queued": False,
                "queue_error": str(exc),
            }
        ), 202

    return jsonify(
        {
            "code": 0,
            "message": "ok",
            "run_id": run.id,
            "record_id": record.id,
            "queued": True,
            "queue": delivery,
        }
    ), 202
