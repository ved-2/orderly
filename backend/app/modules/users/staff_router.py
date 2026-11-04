from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.modules.users.models import StaffInvitation, User

router = APIRouter(prefix="/distributor/staff", tags=["Distributor - Staff"])

ALLOWED_ROLES = {"ORDER_DESK", "SALESMAN", "DISTRIBUTOR_ADMIN"}


class StaffInviteRequest(BaseModel):
    email: EmailStr
    role: Literal["ORDER_DESK", "SALESMAN", "DISTRIBUTOR_ADMIN"]

    model_config = ConfigDict(extra="forbid")


@router.get("")
def list_staff_and_invitations(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN")),
):
    # 1. Active staff members
    staff_users = db.scalars(
        select(User)
        .where(User.role.in_(["DISTRIBUTOR_ADMIN", "ORDER_DESK", "SALESMAN"]))
        .order_by(User.created_at.desc())
    ).all()

    # 2. Pending active invitations
    now = datetime.now(timezone.utc)
    invitations = db.scalars(
        select(StaffInvitation)
        .where(
            StaffInvitation.used_at.is_(None),
            StaffInvitation.expires_at > now,
        )
        .order_by(StaffInvitation.created_at.desc())
    ).all()

    return {
        "staff": [
            {
                "id": str(u.id),
                "email": u.email,
                "role": u.role,
                "phone": u.phone,
                "is_active": u.is_active,
                "created_at": u.created_at,
            }
            for u in staff_users
        ],
        "pending_invitations": [
            {
                "id": str(inv.id),
                "email": inv.email,
                "role": inv.role,
                "expires_at": inv.expires_at,
                "created_at": inv.created_at,
            }
            for inv in invitations
        ],
    }


@router.post("/invite")
def create_staff_invitation(
    payload: StaffInviteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN")),
):
    email = payload.email.strip().lower()

    # Check if active staff already exists with this email
    existing_staff = db.scalar(
        select(User).where(
            User.email == email,
            User.is_active.is_(True),
            User.role.in_(["DISTRIBUTOR_ADMIN", "ORDER_DESK", "SALESMAN"]),
        )
    )
    if existing_staff:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An active staff member with email '{email}' already exists with role '{existing_staff.role}'.",
        )

    # Generate single-use secure random token
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    invitation = StaffInvitation(
        email=email,
        role=payload.role,
        token_hash=token_hash,
        expires_at=expires_at,
        invited_by=current_user.id,
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    return {
        "id": str(invitation.id),
        "email": invitation.email,
        "role": invitation.role,
        "token": raw_token,
        "invitation_link": f"/invite?token={raw_token}",
        "expires_at": invitation.expires_at,
        "message": f"Invitation created for {invitation.email} as {invitation.role}.",
    }


@router.post("/invitations/{invitation_id}/revoke")
def revoke_staff_invitation(
    invitation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN")),
):
    invitation = db.get(StaffInvitation, invitation_id)
    if invitation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found.",
        )

    db.delete(invitation)
    db.commit()

    return {"message": "Invitation revoked successfully."}
