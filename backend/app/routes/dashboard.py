from datetime import datetime, timedelta, timezone

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func

from ..extensions import db
from ..models import Application, MetricSeriesPoint, TrainingRun
from ..security import auth_required
from ..timeseries import backfill_metric_series_for_run

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


def _parse_limit(raw: str | None, default: int, min_value: int, max_value: int) -> int:
    try:
        value = int(raw or str(default))
    except (TypeError, ValueError):
        value = default
    return min(max(value, min_value), max_value)


def _parse_optional_int(raw: str | None) -> int | None:
    try:
        value = int(raw or "")
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None


def _to_iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


@dashboard_bp.get("/overview")
@auth_required
def dashboard_overview():
    recent_limit = _parse_limit(request.args.get("recent_limit"), default=8, min_value=1, max_value=30)
    app_rank_limit = _parse_limit(request.args.get("app_rank_limit"), default=6, min_value=1, max_value=20)
    pulse_limit = _parse_limit(request.args.get("pulse_limit"), default=80, min_value=10, max_value=500)
    featured_run_id = _parse_optional_int(request.args.get("featured_run_id"))
    requested_metric = (request.args.get("metric") or "").strip()

    app_rows = Application.query.filter_by(created_by=g.user.id).order_by(Application.id.desc()).all()
    apps_payload = [
        {
            "id": app.id,
            "name": app.name,
            "app_id": app.app_id,
            "created_at": app.created_at.isoformat(),
        }
        for app in app_rows
    ]

    if not app_rows:
        return jsonify(
            {
                "summary": {
                    "app_count": 0,
                    "run_count": 0,
                    "active_runs_24h": 0,
                    "latest_report_at": None,
                },
                "apps": [],
                "app_run_stats": [],
                "recent_runs": [],
                "featured": {
                    "run": None,
                    "metric_names": [],
                    "selected_metric": None,
                    "points": [],
                },
            }
        )

    app_ids = [app.id for app in app_rows]
    now = datetime.now(timezone.utc)
    active_cutoff = now - timedelta(hours=24)

    run_count = (
        db.session.query(func.count(TrainingRun.id)).filter(TrainingRun.app_id.in_(app_ids)).scalar()
        or 0
    )
    active_runs_24h = (
        db.session.query(func.count(TrainingRun.id))
        .filter(TrainingRun.app_id.in_(app_ids), TrainingRun.last_seen_at >= active_cutoff)
        .scalar()
        or 0
    )
    latest_report_at = (
        db.session.query(func.max(TrainingRun.last_seen_at)).filter(TrainingRun.app_id.in_(app_ids)).scalar()
    )

    app_stat_rows = (
        db.session.query(
            Application.id.label("app_pk"),
            Application.name.label("app_name"),
            Application.app_id.label("app_id"),
            func.count(TrainingRun.id).label("run_count"),
            func.max(TrainingRun.last_seen_at).label("latest_report_at"),
        )
        .outerjoin(TrainingRun, TrainingRun.app_id == Application.id)
        .filter(Application.created_by == g.user.id)
        .group_by(Application.id)
        .all()
    )

    app_stats_payload = sorted(
        [
            {
                "app_pk": int(row.app_pk),
                "name": str(row.app_name),
                "app_id": str(row.app_id),
                "run_count": int(row.run_count or 0),
                "latest_report_at": _to_iso(row.latest_report_at),
                "_latest_ts": row.latest_report_at.timestamp() if row.latest_report_at else 0.0,
            }
            for row in app_stat_rows
        ],
        key=lambda item: (item["run_count"], item["_latest_ts"]),
        reverse=True,
    )[:app_rank_limit]

    for item in app_stats_payload:
        item.pop("_latest_ts", None)

    recent_rows = (
        db.session.query(TrainingRun, Application)
        .join(Application, TrainingRun.app_id == Application.id)
        .filter(Application.created_by == g.user.id)
        .order_by(TrainingRun.last_seen_at.desc(), TrainingRun.id.desc())
        .limit(recent_limit)
        .all()
    )

    recent_runs_payload = [
        {
            "id": run.id,
            "train_id": run.train_id,
            "first_seen_at": run.first_seen_at.isoformat(),
            "last_seen_at": run.last_seen_at.isoformat(),
            "app_pk": app.id,
            "app_name": app.name,
            "app_id": app.app_id,
        }
        for run, app in recent_rows
    ]

    featured_row = None
    if featured_run_id is not None:
        featured_row = (
            db.session.query(TrainingRun, Application)
            .join(Application, TrainingRun.app_id == Application.id)
            .filter(TrainingRun.id == featured_run_id, Application.created_by == g.user.id)
            .first()
        )

    if featured_row is None and recent_rows:
        featured_row = recent_rows[0]

    featured_payload = {
        "run": None,
        "metric_names": [],
        "selected_metric": None,
        "points": [],
    }

    if featured_row is not None:
        featured_run, featured_app = featured_row

        backfill_metric_series_for_run(featured_run.id)

        metric_names = [
            name
            for (name,) in (
                db.session.query(MetricSeriesPoint.metric_name)
                .filter_by(run_id=featured_run.id)
                .distinct()
                .order_by(MetricSeriesPoint.metric_name.asc())
                .all()
            )
        ]
        selected_metric = requested_metric if requested_metric in metric_names else (metric_names[0] if metric_names else None)

        points = []
        if selected_metric:
            point_rows = (
                MetricSeriesPoint.query.filter_by(run_id=featured_run.id, metric_name=selected_metric)
                .order_by(MetricSeriesPoint.event_time.desc(), MetricSeriesPoint.id.desc())
                .limit(pulse_limit)
                .all()
            )

            point_rows = list(reversed(point_rows))
            points = [
                {
                    "id": row.id,
                    "value": row.metric_value,
                    "step": row.step,
                    "epoch": row.epoch,
                    "event_time": row.event_time.isoformat(),
                }
                for row in point_rows
            ]

        featured_payload = {
            "run": {
                "id": featured_run.id,
                "train_id": featured_run.train_id,
                "first_seen_at": featured_run.first_seen_at.isoformat(),
                "last_seen_at": featured_run.last_seen_at.isoformat(),
                "app_pk": featured_app.id,
                "app_name": featured_app.name,
                "app_id": featured_app.app_id,
            },
            "metric_names": metric_names,
            "selected_metric": selected_metric,
            "points": points,
        }

    return jsonify(
        {
            "summary": {
                "app_count": len(app_rows),
                "run_count": int(run_count),
                "active_runs_24h": int(active_runs_24h),
                "latest_report_at": _to_iso(latest_report_at),
            },
            "apps": apps_payload,
            "app_run_stats": app_stats_payload,
            "recent_runs": recent_runs_payload,
            "featured": featured_payload,
        }
    )
