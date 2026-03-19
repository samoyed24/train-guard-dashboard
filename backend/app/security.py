import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import current_app, g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from .models import Application, User
from .redis_client import redis_get, redis_setex


def hash_password(password: str) -> str:
    return generate_password_hash(password)


def verify_password(raw: str, hashed: str) -> bool:
    return check_password_hash(hashed, raw)


def generate_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=current_app.config["JWT_EXPIRES_MINUTES"])
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "jti": secrets.token_hex(16),
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")


def decode_token(token: str):
    return jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])


def token_blacklist_key(jti: str) -> str:
    return f"auth:blacklist:{jti}"


def blacklist_token(jti: str, exp_ts: int) -> None:
    now_ts = int(datetime.now(timezone.utc).timestamp())
    ttl = max(exp_ts - now_ts, 1)
    redis_setex(token_blacklist_key(jti), ttl, "1")


def auth_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return jsonify({"message": "Missing Bearer token"}), 401

        token = header.split(" ", 1)[1].strip()
        try:
            payload = decode_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "Invalid token"}), 401

        if redis_get(token_blacklist_key(payload["jti"])):
            return jsonify({"message": "Token revoked"}), 401

        user = User.query.get(int(payload["sub"]))
        if not user:
            return jsonify({"message": "User not found"}), 401

        g.user = user
        g.token_payload = payload
        return fn(*args, **kwargs)

    return wrapper


def validate_app_credentials(app_id: str, app_secret: str):
    if not app_id or not app_secret:
        return None
    app = Application.query.filter_by(app_id=app_id, is_active=True).first()
    if not app:
        return None
    if not check_password_hash(app.app_secret_hash, app_secret):
        return None
    return app


def app_auth_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        app_id = request.headers.get("X-App-Id") or request.args.get("app_id")
        app_secret = request.headers.get("X-App-Secret") or request.args.get("app_secret")

        body = request.get_json(silent=True) or {}
        app_id = app_id or body.get("app_id")
        app_secret = app_secret or body.get("app_secret")

        app = validate_app_credentials(app_id, app_secret)
        if not app:
            return jsonify({"message": "Invalid app credentials"}), 401

        g.application = app
        return fn(*args, **kwargs)

    return wrapper
