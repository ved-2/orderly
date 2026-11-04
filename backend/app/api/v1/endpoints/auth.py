from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from sqlalchemy import func
from app.api.deps import (
    get_current_user,
    get_db,
    get_verified_firebase_identity,
)
from app.modules.users.models import User
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
