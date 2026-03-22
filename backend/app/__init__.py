from typing import Any

from flask import Flask, jsonify
from flask_cors import CORS

from .config import Config
from .extensions import db
from .routes.access_keys import access_keys_bp
from .routes.agent import agent_bp
from .routes.apps import apps_bp
from .routes.auth import auth_bp
from .routes.dashboard import dashboard_bp
from .routes.team import team_bp
from .timeseries import enable_timeseries_hypertable


def create_app(config_overrides: dict[str, Any] | None = None) -> Flask:
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(Config)
    if config_overrides:
        app.config.update(config_overrides)

    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    db.init_app(app)

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"})

    app.register_blueprint(auth_bp)
    app.register_blueprint(team_bp)
    app.register_blueprint(access_keys_bp)
    app.register_blueprint(apps_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(agent_bp)

    @app.cli.command("init-db")
    def init_db_command():
        db.create_all()
        if app.config.get("ENABLE_TIMESCALE", False):
            if enable_timeseries_hypertable():
                print("Database initialized (TimescaleDB hypertable enabled)")
            else:
                print("Database initialized (fallback to plain metric_series_points table)")
        else:
            print("Database initialized (TimescaleDB disabled)")

    return app
