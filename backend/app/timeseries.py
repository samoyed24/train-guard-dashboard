from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from flask import current_app
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .extensions import db
from .models import MetricRecord, MetricSeriesPoint

_IGNORE_METRIC_KEYS = {
    "train_id",
    "step",
    "global_step",
    "epoch",
    "timestamp",
    "time",
    "created_at",
    "updated_at",
}
_STEP_KEYS = ("step", "global_step")
_EPOCH_KEYS = ("epoch",)


def _parse_optional_int(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        if not math.isfinite(value):
            return None
        return int(value)

    if isinstance(value, str):
        text_value = value.strip()
        if not text_value:
            return None
        try:
            return int(float(text_value))
        except ValueError:
            return None

    return None


def _parse_numeric(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None

    if isinstance(value, (int, float)):
        numeric = float(value)
        return numeric if math.isfinite(numeric) else None

    if isinstance(value, str):
        text_value = value.strip()
        if not text_value:
            return None
        try:
            numeric = float(text_value)
        except ValueError:
            return None
        return numeric if math.isfinite(numeric) else None

    return None


def _pick_first_int(payload: dict[str, Any], keys: tuple[str, ...]) -> int | None:
    for key in keys:
        if key not in payload:
            continue
        parsed = _parse_optional_int(payload[key])
        if parsed is not None:
            return parsed
    return None


def extract_numeric_metrics(payload: dict[str, Any]) -> list[tuple[str, float]]:
    points: list[tuple[str, float]] = []
    for key, raw_value in payload.items():
        if key in _IGNORE_METRIC_KEYS:
            continue

        metric_name = str(key).strip()
        if not metric_name:
            continue

        parsed = _parse_numeric(raw_value)
        if parsed is None:
            continue

        points.append((metric_name, parsed))

    return points


def append_metric_series_points(
    run_id: int,
    payload: dict[str, Any],
    event_time: datetime | None = None,
) -> int:
    if not isinstance(payload, dict):
        return 0

    points = extract_numeric_metrics(payload)
    if not points:
        return 0

    point_time = event_time or datetime.now(timezone.utc)
    step = _pick_first_int(payload, _STEP_KEYS)
    epoch = _pick_first_int(payload, _EPOCH_KEYS)

    for metric_name, metric_value in points:
        db.session.add(
            MetricSeriesPoint(
                run_id=run_id,
                metric_name=metric_name,
                metric_value=metric_value,
                step=step,
                epoch=epoch,
                event_time=point_time,
            )
        )

    return len(points)


def backfill_metric_series_for_run(run_id: int, max_records: int = 2000) -> int:
    exists = MetricSeriesPoint.query.filter_by(run_id=run_id).first()
    if exists:
        return 0

    rows = (
        MetricRecord.query.filter_by(run_id=run_id)
        .order_by(MetricRecord.received_at.asc(), MetricRecord.id.asc())
        .limit(max(1, max_records))
        .all()
    )

    inserted = 0
    for row in rows:
        if not isinstance(row.payload, dict):
            continue
        inserted += append_metric_series_points(run_id=row.run_id, payload=row.payload, event_time=row.received_at)

    if not inserted:
        return 0

    try:
        db.session.commit()
        return inserted
    except SQLAlchemyError as exc:
        db.session.rollback()
        current_app.logger.warning("Backfill metric series failed: %s", exc)
        return 0


def enable_timeseries_hypertable() -> bool:
    try:
        db.session.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb;"))
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        current_app.logger.warning("TimescaleDB extension creation skipped: %s", exc)

    try:
        db.session.execute(
            text(
                "SELECT create_hypertable('metric_series_points', 'event_time', if_not_exists => TRUE);"
            )
        )
        db.session.commit()
        return True
    except SQLAlchemyError as exc:
        db.session.rollback()
        current_app.logger.warning("Create hypertable failed, fallback to plain table: %s", exc)
        return False
