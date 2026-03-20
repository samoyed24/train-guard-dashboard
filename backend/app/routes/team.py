import secrets
from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request

from ..extensions import db
from ..models import Team, TeamInvite, TeamMember, User
from ..security import auth_required

team_bp = Blueprint("team", __name__, url_prefix="/api/team")

ROLE_ADMIN = "team_admin"
ROLE_MEMBER = "team_member"
VALID_ROLES = {ROLE_ADMIN, ROLE_MEMBER}

INVITE_PENDING = "pending"
INVITE_ACCEPTED = "accepted"
INVITE_REVOKED = "revoked"


def _now_utc():
    return datetime.now(timezone.utc)


def _normalize_role(value, default: str | None = None) -> str | None:
    if value in VALID_ROLES:
        return value
    return default


def _team_permissions(role: str):
    is_admin = role == ROLE_ADMIN
    return {
        "manage_members": is_admin,
        "invite_members": is_admin,
        "manage_roles": is_admin,
        "view_audit": True,
    }


def _team_or_404(team_id: int):
    team = Team.query.filter_by(id=team_id).first()
    if not team:
        return None, (jsonify({"message": "Team not found"}), 404)
    return team, None


def _membership_for_user(user_id: int) -> TeamMember | None:
    return TeamMember.query.filter_by(user_id=user_id).first()


def _require_team_admin(user_id: int):
    membership = _membership_for_user(user_id)
    if not membership:
        return None, None, (jsonify({"message": "Not in team"}), 403)

    team, team_error = _team_or_404(membership.team_id)
    if team_error:
        return None, None, team_error

    if membership.role != ROLE_ADMIN:
        return None, None, (jsonify({"message": "Admin role required"}), 403)

    return membership, team, None


def _build_team_payload(team: Team, membership: TeamMember):
    members = (
        db.session.query(TeamMember, User)
        .join(User, User.id == TeamMember.user_id)
        .filter(TeamMember.team_id == team.id)
        .order_by(TeamMember.id.asc())
        .all()
    )

    member_items = [
        {
            "id": item.id,
            "user_id": item.user_id,
            "name": user.name,
            "email": user.email,
            "role": item.role,
            "joined_at": item.joined_at.isoformat(),
        }
        for item, user in members
    ]

    invites = (
        TeamInvite.query.filter_by(team_id=team.id)
        .order_by(TeamInvite.id.desc())
        .all()
    )

    invite_items = [
        {
            "id": invite.id,
            "email": invite.email,
            "role": invite.role,
            "status": invite.status,
            "token": invite.token,
            "created_at": invite.created_at.isoformat(),
            "accepted_at": invite.accepted_at.isoformat() if invite.accepted_at else None,
        }
        for invite in invites
    ]

    return {
        "team": {
            "id": team.id,
            "name": team.name,
            "description": team.description or "",
            "created_at": team.created_at.isoformat(),
        },
        "my_role": membership.role,
        "permissions": _team_permissions(membership.role),
        "members": member_items,
        "invites": invite_items,
    }


def _accept_invite(invite: TeamInvite, user: User):
    if invite.status != INVITE_PENDING:
        return jsonify({"message": "Invite is no longer active"}), 409

    if invite.email != user.email:
        return jsonify({"message": "This invite does not match current account"}), 403

    existing = _membership_for_user(user.id)
    if existing and existing.team_id == invite.team_id:
        return jsonify({"message": "Already in team"}), 409

    invite.status = INVITE_ACCEPTED
    invite.accepted_by = user.id
    invite.accepted_at = _now_utc()

    if existing and existing.team_id != invite.team_id:
        existing.team_id = invite.team_id
        existing.role = invite.role
        existing.joined_at = _now_utc()
    elif not existing:
        db.session.add(
            TeamMember(
                team_id=invite.team_id,
                user_id=user.id,
                role=invite.role,
                joined_at=_now_utc(),
            )
        )

    db.session.commit()
    return None


@team_bp.get("/current")
@auth_required
def get_current_team():
    membership = _membership_for_user(g.user.id)
    if not membership:
        return jsonify({"message": "You have not joined any team"}), 404

    team, team_error = _team_or_404(membership.team_id)
    if team_error:
        return team_error

    return jsonify(_build_team_payload(team, membership))


@team_bp.post("/join")
@auth_required
def join_team_by_invite_token():
    payload = request.get_json() or {}
    token = (payload.get("token") or "").strip()
    if not token:
        return jsonify({"message": "token required"}), 400

    invite = TeamInvite.query.filter_by(token=token).first()
    if not invite:
        return jsonify({"message": "Invite token not found"}), 404

    error = _accept_invite(invite, g.user)
    if error:
        return error

    return jsonify({"message": "joined", "team_id": invite.team_id})


@team_bp.post("/invites")
@auth_required
def create_team_invite():
    membership, team, error = _require_team_admin(g.user.id)
    if error:
        return error

    payload = request.get_json() or {}
    email = (payload.get("email") or "").strip().lower()
    role = _normalize_role(payload.get("role"), default=ROLE_MEMBER)

    if not email or "@" not in email:
        return jsonify({"message": "valid email required"}), 400

    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        existing_membership = TeamMember.query.filter_by(team_id=team.id, user_id=existing_user.id).first()
        if existing_membership:
            return jsonify({"message": "User is already in the team"}), 409

    pending = TeamInvite.query.filter_by(team_id=team.id, email=email, status=INVITE_PENDING).first()
    if pending:
        return (
            jsonify(
                {
                    "invite_id": pending.id,
                    "email": pending.email,
                    "role": pending.role,
                    "status": pending.status,
                    "token": pending.token,
                    "created_at": pending.created_at.isoformat(),
                }
            ),
            200,
        )

    invite = TeamInvite(
        team_id=team.id,
        email=email,
        role=role,
        invited_by=membership.user_id,
        status=INVITE_PENDING,
        token=f"invite_{secrets.token_hex(20)}",
    )
    db.session.add(invite)
    db.session.commit()

    return (
        jsonify(
            {
                "invite_id": invite.id,
                "email": invite.email,
                "role": invite.role,
                "status": invite.status,
                "token": invite.token,
                "created_at": invite.created_at.isoformat(),
            }
        ),
        201,
    )


@team_bp.post("/invites/<int:invite_id>/revoke")
@auth_required
def revoke_team_invite(invite_id: int):
    _, team, error = _require_team_admin(g.user.id)
    if error:
        return error

    invite = TeamInvite.query.filter_by(id=invite_id, team_id=team.id).first()
    if not invite:
        return jsonify({"message": "Invite not found"}), 404

    if invite.status != INVITE_PENDING:
        return jsonify({"message": "Only pending invite can be revoked"}), 409

    invite.status = INVITE_REVOKED
    db.session.commit()
    return jsonify({"message": "revoked"})


@team_bp.post("/invites/<int:invite_id>/accept")
@auth_required
def accept_team_invite(invite_id: int):
    invite = TeamInvite.query.filter_by(id=invite_id).first()
    if not invite:
        return jsonify({"message": "Invite not found"}), 404

    error = _accept_invite(invite, g.user)
    if error:
        return error

    return jsonify({"message": "accepted", "team_id": invite.team_id})


@team_bp.patch("/members/<int:member_id>/role")
@auth_required
def update_member_role(member_id: int):
    _, team, error = _require_team_admin(g.user.id)
    if error:
        return error

    payload = request.get_json() or {}
    role = _normalize_role(payload.get("role"))
    if not role:
        return jsonify({"message": "invalid role"}), 400

    member = TeamMember.query.filter_by(id=member_id, team_id=team.id).first()
    if not member:
        return jsonify({"message": "Member not found"}), 404

    member.role = role
    db.session.commit()
    return jsonify({"message": "updated", "role": role})


@team_bp.delete("/members/<int:member_id>")
@auth_required
def remove_member(member_id: int):
    _, team, error = _require_team_admin(g.user.id)
    if error:
        return error

    member = TeamMember.query.filter_by(id=member_id, team_id=team.id).first()
    if not member:
        return jsonify({"message": "Member not found"}), 404

    if member.user_id == g.user.id:
        return jsonify({"message": "Cannot remove yourself"}), 409

    db.session.delete(member)
    db.session.commit()
    return jsonify({"message": "removed"})
