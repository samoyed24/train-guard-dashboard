import secrets

from flask import Blueprint, g, jsonify, request
from werkzeug.security import generate_password_hash

from ..extensions import db
from ..models import AccessKey
from ..security import auth_required

access_keys_bp = Blueprint("access_keys", __name__, url_prefix="/api/access-keys")


def _access_key_to_dict(row: AccessKey):
    return {
        "id": row.id,
        "name": row.name,
        "access_key_id": row.access_key_id,
        "is_active": row.is_active,
        "created_at": row.created_at.isoformat(),
        "last_used_at": row.last_used_at.isoformat() if row.last_used_at else None,
    }


@access_keys_bp.get("")
@auth_required
def list_access_keys():
    rows = AccessKey.query.filter_by(user_id=g.user.id).order_by(AccessKey.id.desc()).all()
    return jsonify([_access_key_to_dict(row) for row in rows])


@access_keys_bp.post("")
@auth_required
def create_access_key():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"message": "name required"}), 400

    access_key_id = f"ak_{secrets.token_hex(8)}"
    secret_key = f"sk_{secrets.token_hex(16)}"

    row = AccessKey(
        user_id=g.user.id,
        name=name,
        access_key_id=access_key_id,
        secret_key_hash=generate_password_hash(secret_key),
    )
    db.session.add(row)
    db.session.commit()

    payload = _access_key_to_dict(row)
    payload["secret_key"] = secret_key
    return jsonify(payload), 201


@access_keys_bp.delete("/<int:key_id>")
@auth_required
def revoke_access_key(key_id: int):
    row = AccessKey.query.filter_by(id=key_id, user_id=g.user.id).first_or_404()
    row.is_active = False
    db.session.commit()
    return jsonify({"message": "revoked"})
