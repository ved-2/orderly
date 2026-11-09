from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from sqlalchemy import func
from app.api.deps import (
    get_current_user,
    get_db,
    get_firebase_identity,
    get_verified_firebase_identity,
)
from app.core.firebase import get_firebase_app
from firebase_admin import auth as fb_admin_auth
from datetime import datetime, timezone
import hashlib
from app.modules.users.models import User, StaffInvitation
from fastapi import HTTPException, status
from app.modules.retailers.models import RetailerUser, Retailer

router = APIRouter(prefix="/auth", tags=["Authentication"])


class UserProfileResponse(BaseModel):
    id: UUID
    email: str
    phone: str | None
    role: str
    is_active: bool

    retailer_id: UUID | None = None
    retailer_registration_status: str | None = None

    model_config = ConfigDict(from_attributes=True)


@router.get("/me", response_model=UserProfileResponse)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    retailer = db.scalar(
        select(Retailer)
        .join(
            RetailerUser,
            RetailerUser.retailer_id == Retailer.id,
        )
        .where(RetailerUser.user_id == current_user.id)
    )

    return {
        "id": current_user.id,
        "email": current_user.email,
        "phone": current_user.phone,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "retailer_id": retailer.id if retailer else None,
        "retailer_registration_status": (
            retailer.registration_status if retailer else None
        ),
    }

@router.post("/distributor/register")
def register_distributor_admin(
    identity: dict = Depends(get_verified_firebase_identity),
    db: Session = Depends(get_db),
):
    email = identity["email"].strip().lower()
    firebase_uid = identity["firebase_uid"]

    user = db.scalar(
        select(User).where(
            (User.firebase_uid == firebase_uid)
            | (func.lower(User.email) == email)
        )
    )

    if user is None:
        user = User(
            firebase_uid=firebase_uid,
            email=email,
            role="DISTRIBUTOR_ADMIN",
            is_active=True,
        )
        db.add(user)
    else:
        user.role = "DISTRIBUTOR_ADMIN"
        user.is_active = True
        user.firebase_uid = firebase_uid

    db.commit()
    db.refresh(user)

    return {
        "id": str(user.id),
        "email": user.email,
        "role": user.role,
        "message": "Distributor administrator registered successfully.",
    }

@router.get("/invitations/{token}")
def get_invitation_info(
    token: str,
    db: Session = Depends(get_db),
):
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    invitation = db.scalar(
        select(StaffInvitation).where(StaffInvitation.token_hash == token_hash)
    )
    if invitation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation token is invalid or does not exist.",
        )

    if invitation.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invitation has already been redeemed.",
        )

    now = datetime.now(timezone.utc)
    if invitation.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invitation has expired. Please contact the administrator for a new invite.",
        )

    return {
        "email": invitation.email,
        "role": invitation.role,
        "expires_at": invitation.expires_at,
        "is_valid": True,
    }


@router.post("/invitations/{token}/accept")
def accept_staff_invitation(
    token: str,
    identity: dict = Depends(get_firebase_identity),
    db: Session = Depends(get_db),
):
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    invitation = db.scalar(
        select(StaffInvitation)
        .where(StaffInvitation.token_hash == token_hash)
        .with_for_update()
    )
    if invitation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation token is invalid.",
        )

    if invitation.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invitation has already been redeemed.",
        )

    now = datetime.now(timezone.utc)
    if invitation.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invitation has expired.",
        )

    caller_email = identity["email"].strip().lower()
    if caller_email != invitation.email.strip().lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Email mismatch. This invitation was issued to '{invitation.email}', "
                f"but you are signed in as '{caller_email}'."
            ),
        )

    firebase_uid = identity["firebase_uid"]
    user = db.scalar(
        select(User).where(
            (User.firebase_uid == firebase_uid)
            | (func.lower(User.email) == caller_email)
        )
    )

    if user is None:
        user = User(
            firebase_uid=firebase_uid,
            email=caller_email,
            role=invitation.role,
            is_active=True,
        )
        db.add(user)
    else:
        user.role = invitation.role
        user.is_active = True
        user.firebase_uid = firebase_uid

    invitation.used_at = now
    db.commit()
    db.refresh(user)

    # Automatically mark account as email_verified in Firebase
    try:
        fb_admin_auth.update_user(firebase_uid, email_verified=True, app=get_firebase_app())
    except Exception as ex:
        print("Note: Could not update Firebase email_verified:", ex)

    return {
        "id": str(user.id),
        "email": user.email,
        "role": user.role,
        "message": f"Successfully joined Orderly as {user.role}.",
    }
