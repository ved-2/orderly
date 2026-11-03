from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
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