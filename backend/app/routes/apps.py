import secrets
from datetime import datetime, timezone

from werkzeug.security import generate_password_hash
from flask import Blueprint, g, jsonify, request

from ..extensions import db
from ..models import Application, ConfigVersion, MetricRecord, MetricSeriesPoint, TrainingRun
from ..redis_client import redis_cache
from ..security import auth_required
from ..timeseries import backfill_metric_series_for_run

apps_bp = Blueprint("apps", __name__, url_prefix="/api/projects")


def _app_to_dict(app: Application):
    return {
        "id": app.id,
        "name": app.name,
        "project_id": app.app_id,
        "is_active": app.is_active,
        "created_at": app.created_at.isoformat(),
    }


def _parse_limit(raw: str | None, default: int, min_value: int, max_value: int) -> int:
    try:
        value = int(raw or str(default))
    except (TypeError, ValueError):
        value = default
    return min(max(value, min_value), max_value)


def _serialize_config(row: ConfigVersion | None):
    if not row:
        return None

    return {
        "id": row.id,
        "version": row.version,
        "is_active": row.is_active,
        "content": row.content,
        "created_at": row.created_at.isoformat(),
        "published_at": row.published_at.isoformat() if row.published_at else None,
    }


@apps_bp.get("")
@auth_required
def list_apps():
    apps = Application.query.filter_by(created_by=g.user.id).order_by(Application.id.desc()).all()
    return jsonify([_app_to_dict(a) for a in apps])


@apps_bp.post("")
@auth_required
def create_app():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"message": "name required"}), 400

    project_id = f"project_{secrets.token_hex(8)}"
    project_secret = f"secret_{secrets.token_hex(16)}"
    app = Application(
        name=name,
        app_id=project_id,
        app_secret_hash=generate_password_hash(project_secret),
        created_by=g.user.id,
    )
    db.session.add(app)
    db.session.commit()

    result = _app_to_dict(app)
    result["project_secret"] = project_secret
    return jsonify(result), 201


@apps_bp.get("/<int:app_pk>/configs")
@auth_required
def list_configs(app_pk: int):
    app = Application.query.filter_by(id=app_pk, created_by=g.user.id).first_or_404()
    rows = ConfigVersion.query.filter_by(app_id=app.id).order_by(ConfigVersion.version.desc()).all()
    return jsonify(
        [
            {
                "id": r.id,
                "version": r.version,
                "is_active": r.is_active,
                "content": r.content,
                "created_at": r.created_at.isoformat(),
                "published_at": r.published_at.isoformat() if r.published_at else None,
            }
            for r in rows
        ]
    )


@apps_bp.get("/<int:app_pk>/config")
@auth_required
def get_current_config(app_pk: int):
    app = Application.query.filter_by(id=app_pk, created_by=g.user.id).first_or_404()
    row = (
        ConfigVersion.query.filter_by(app_id=app.id)
        .order_by(ConfigVersion.is_active.desc(), ConfigVersion.version.desc(), ConfigVersion.id.desc())
        .first()
    )
    return jsonify(_serialize_config(row))


@apps_bp.put("/<int:app_pk>/config")
@auth_required
def upsert_current_config(app_pk: int):
    app = Application.query.filter_by(id=app_pk, created_by=g.user.id).first_or_404()
    data = request.get_json() or {}
    content = data.get("content")
    if not isinstance(content, dict):
        return jsonify({"message": "content must be JSON object"}), 400

    current = (
        ConfigVersion.query.filter_by(app_id=app.id)
        .order_by(ConfigVersion.is_active.desc(), ConfigVersion.version.desc(), ConfigVersion.id.desc())
        .first()
    )

    if current:
        current.content = content
        current.is_active = True
        current.published_by = g.user.id
        current.published_at = datetime.now(timezone.utc)
        row = current
    else:
        row = ConfigVersion(
            app_id=app.id,
            version=1,
            content=content,
            is_active=True,
            published_by=g.user.id,
            published_at=datetime.now(timezone.utc),
        )
        db.session.add(row)

    db.session.flush()
    ConfigVersion.query.filter(ConfigVersion.app_id == app.id, ConfigVersion.id != row.id).update({"is_active": False})
    row.is_active = True
    db.session.commit()

    redis_cache.set_active_config(app.app_id, row.content, ttl_seconds=3600)
    return jsonify(_serialize_config(row))

@apps_bp.post("/<int:app_pk>/configs")
@auth_required
def create_config(app_pk: int):
    app = Application.query.filter_by(id=app_pk, created_by=g.user.id).first_or_404()
    data = request.get_json() or {}
    content = data.get("content")
    if not isinstance(content, dict):
        return jsonify({"message": "content must be JSON object"}), 400

    max_version = db.session.query(db.func.max(ConfigVersion.version)).filter_by(app_id=app.id).scalar() or 0
    row = ConfigVersion(
        app_id=app.id,
        version=max_version + 1,
        content=content,
        published_by=g.user.id,
    )
    db.session.add(row)
    db.session.commit()
    return jsonify({"id": row.id, "version": row.version, "is_active": row.is_active}), 201


@apps_bp.post("/<int:app_pk>/configs/<int:config_id>/publish")
@auth_required
def publish_config(app_pk: int, config_id: int):
    app = Application.query.filter_by(id=app_pk, created_by=g.user.id).first_or_404()
    row = ConfigVersion.query.filter_by(id=config_id, app_id=app.id).first_or_404()

    ConfigVersion.query.filter_by(app_id=app.id, is_active=True).update({"is_active": False})
    row.is_active = True
    row.published_at = datetime.now(timezone.utc)
    db.session.commit()

    redis_cache.set_active_config(app.app_id, row.content, ttl_seconds=3600)
    return jsonify({"message": "published", "version": row.version})


@apps_bp.get("/<int:app_pk>/runs")
@auth_required
def list_runs(app_pk: int):
    app = Application.query.filter_by(id=app_pk, created_by=g.user.id).first_or_404()
    rows = TrainingRun.query.filter_by(app_id=app.id).order_by(TrainingRun.last_seen_at.desc()).all()
    return jsonify(
        [
            {
                "id": r.id,
                "train_id": r.train_id,
                "first_seen_at": r.first_seen_at.isoformat(),
                "last_seen_at": r.last_seen_at.isoformat(),
            }
            for r in rows
        ]
    )


@apps_bp.get("/<int:app_pk>/runs/<int:run_id>/metrics")
@auth_required
def list_run_metrics(app_pk: int, run_id: int):
    app = Application.query.filter_by(id=app_pk, created_by=g.user.id).first_or_404()
    run = TrainingRun.query.filter_by(id=run_id, app_id=app.id).first_or_404()
    limit = _parse_limit(request.args.get("limit"), default=50, min_value=1, max_value=500)
    rows = (
        MetricRecord.query.filter_by(run_id=run.id)
        .order_by(MetricRecord.id.desc())
        .limit(limit)
        .all()
    )
    return jsonify(
        [
            {
                "id": r.id,
                "received_at": r.received_at.isoformat(),
                "payload": r.payload,
            }
            for r in rows
        ]
    )


@apps_bp.get("/<int:app_pk>/runs/<int:run_id>/metrics/series")
@auth_required
def list_run_metric_series(app_pk: int, run_id: int):
    app = Application.query.filter_by(id=app_pk, created_by=g.user.id).first_or_404()
    run = TrainingRun.query.filter_by(id=run_id, app_id=app.id).first_or_404()

    # Read paths can be called against historical records created before the new series table was introduced.
    backfill_metric_series_for_run(run.id)

    limit = _parse_limit(request.args.get("limit"), default=240, min_value=10, max_value=2000)
    metric = (request.args.get("metric") or "").strip()

    metric_names = [
        name
        for (name,) in (
            db.session.query(MetricSeriesPoint.metric_name)
            .filter_by(run_id=run.id)
            .distinct()
            .order_by(MetricSeriesPoint.metric_name.asc())
            .all()
        )
    ]

    selected_metric = metric if metric in metric_names else (metric_names[0] if metric_names else None)
    points = []

    if selected_metric:
        rows = (
            MetricSeriesPoint.query.filter_by(run_id=run.id, metric_name=selected_metric)
            .order_by(MetricSeriesPoint.event_time.desc(), MetricSeriesPoint.id.desc())
            .limit(limit)
            .all()
        )

        rows = list(reversed(rows))
        points = [
            {
                "id": row.id,
                "metric_name": row.metric_name,
                "value": row.metric_value,
                "step": row.step,
                "epoch": row.epoch,
                "event_time": row.event_time.isoformat(),
            }
            for row in rows
        ]

    return jsonify(
        {
            "run_id": run.id,
            "train_id": run.train_id,
            "metric_names": metric_names,
            "selected_metric": selected_metric,
            "points": points,
        }
    )
