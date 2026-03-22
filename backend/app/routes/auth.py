import random

from flask import Blueprint, current_app, g, jsonify, request

from ..email_client import send_email
from ..extensions import db
from ..models import Team, TeamMember, User
from ..redis_client import redis_cache, redis_keys
from ..security import auth_required, blacklist_token, generate_token, hash_password, verify_password

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def internal_error_message(default_message: str, exc: Exception) -> str:
    current_app.logger.exception(default_message)
    return default_message


def register_email_code_key(email: str) -> str:
    return redis_keys.register_email_code(email)


def register_email_code_cooldown_key(email: str) -> str:
    return redis_keys.register_email_code_cooldown(email)


def generate_email_code() -> str:
    return f"{random.randint(0, 999999):06d}"


@auth_bp.post("/register/email-code")
def send_register_email_code():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()

    if not email or "@" not in email:
        return jsonify({"message": "valid email required"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"message": "Email already exists"}), 409

    if redis_cache.get_register_email_code_cooldown(email):
        return jsonify({"message": "Please wait before requesting another code"}), 429

    code = generate_email_code()
    ttl_seconds = current_app.config["EMAIL_CODE_TTL_SECONDS"]
    cooldown_seconds = current_app.config["EMAIL_CODE_COOLDOWN_SECONDS"]

    subject = "Train Guard 注册验证码"
    body = f"你的注册验证码是：{code}。\n\n验证码 {ttl_seconds} 秒内有效。"
    try:
        send_email(email, subject, body)
    except Exception as exc:
        return (
            jsonify({"message": internal_error_message("Failed to send verification email", exc)}),
            500,
        )

    redis_cache.set_register_email_code(email, ttl_seconds, code)
    redis_cache.set_register_email_code_cooldown(email, cooldown_seconds)

    return jsonify({"message": "ok"})


@auth_bp.post("/register")
def register():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    name = (data.get("name") or "").strip()
    password = data.get("password") or ""
    verification_code = (data.get("verification_code") or "").strip()

    if not email or not name or len(password) < 6 or not verification_code:
        return jsonify({"message": "name/email/password(>=6)/verification_code required"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"message": "Email already exists"}), 409

    saved_code = redis_cache.get_register_email_code(email)
    if not saved_code or saved_code != verification_code:
        return jsonify({"message": "Invalid or expired verification code"}), 400

    user = User(email=email, name=name, password_hash=hash_password(password))
    db.session.add(user)
    db.session.commit()
    redis_cache.delete_register_email_code(email)

    # Bootstrap a default team for the very first account so team invitation flow is usable immediately.
    if Team.query.count() == 0:
        team = Team(
            name="Train Guard Core Team",
            description="Default team for bootstrap and permissions setup.",
            created_by=user.id,
        )
        db.session.add(team)
        db.session.flush()
        db.session.add(
            TeamMember(
                team_id=team.id,
                user_id=user.id,
                role="team_admin",
            )
        )
        db.session.commit()

    return jsonify({"message": "ok"}), 201


@auth_bp.post("/login")
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not verify_password(password, user.password_hash):
        return jsonify({"message": "Invalid credentials"}), 401

    token = generate_token(user.id)
    return jsonify(
        {
            "token": token,
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
            },
        }
    )


@auth_bp.get("/me")
@auth_required
def me():
    return jsonify({"id": g.user.id, "name": g.user.name, "email": g.user.email})


@auth_bp.post("/logout")
@auth_required
def logout():
    payload = g.token_payload
    blacklist_token(payload["jti"], payload["exp"])
    return jsonify({"message": "ok"})
