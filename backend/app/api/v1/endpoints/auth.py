
from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.modules.users.models import User


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/me")
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "phone": current_user.phone,
        "role": current_user.role,
        "is_active": current_user.is_active,
    }
