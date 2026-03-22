import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import current_app, g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from .extensions import db
from .models import AccessKey, Application, User
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


def validate_project_credentials(project_id: str, project_secret: str):
    if not project_id or not project_secret:
        return None
    app = Application.query.filter_by(app_id=project_id, is_active=True).first()
    if not app:
        return None
    if not check_password_hash(app.app_secret_hash, project_secret):
        return None
    return app


def project_auth_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        project_id = request.headers.get("X-Project-Id") or request.args.get("project_id")
        project_secret = request.headers.get("X-Project-Secret") or request.args.get("project_secret")

        body = request.get_json(silent=True) or {}
        project_id = project_id or body.get("project_id")
        project_secret = project_secret or body.get("project_secret")

        app = validate_project_credentials(project_id, project_secret)
        if not app:
            return jsonify({"message": "Invalid project credentials"}), 401

        g.project = app
        return fn(*args, **kwargs)

    return wrapper


def validate_access_key_credentials(access_key_id: str, secret_key: str):
    if not access_key_id or not secret_key:
        return None

    access_key = AccessKey.query.filter_by(access_key_id=access_key_id, is_active=True).first()
    if not access_key:
        return None

    if not check_password_hash(access_key.secret_key_hash, secret_key):
        return None

    return access_key


def access_key_auth_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        access_key_id = request.headers.get("X-Access-Key-Id") or request.args.get("access_key_id")
        secret_key = request.headers.get("X-Secret-Key") or request.args.get("secret_key")

        body = request.get_json(silent=True) or {}
        access_key_id = access_key_id or body.get("access_key_id")
        secret_key = secret_key or body.get("secret_key")

        access_key = validate_access_key_credentials(access_key_id, secret_key)
        if not access_key:
            return jsonify({"message": "Invalid access key credentials"}), 401

        user = User.query.get(access_key.user_id)
        if not user:
            return jsonify({"message": "Access key owner not found"}), 401

        access_key.last_used_at = datetime.now(timezone.utc)
        db.session.commit()

        g.access_key = access_key
        g.access_key_user = user
        return fn(*args, **kwargs)

    return wrapper
