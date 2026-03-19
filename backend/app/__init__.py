from flask import Flask, jsonify
from flask_cors import CORS

from .config import Config
from .extensions import db
from .routes.agent import agent_bp
from .routes.apps import apps_bp
from .routes.auth import auth_bp


def create_app() -> Flask:
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(Config)

    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    db.init_app(app)

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"})

    app.register_blueprint(auth_bp)
    app.register_blueprint(apps_bp)
    app.register_blueprint(agent_bp)

    @app.cli.command("init-db")
    def init_db_command():
        db.create_all()
        print("Database initialized")

    return app
