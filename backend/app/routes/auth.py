from flask import Blueprint, g, jsonify, request

from ..extensions import db
from ..models import User
from ..security import auth_required, blacklist_token, generate_token, hash_password, verify_password

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.post("/register")
def register():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    name = (data.get("name") or "").strip()
    password = data.get("password") or ""

    if not email or not name or len(password) < 6:
        return jsonify({"message": "name/email/password(>=6) required"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"message": "Email already exists"}), 409

    user = User(email=email, name=name, password_hash=hash_password(password))
    db.session.add(user)
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
