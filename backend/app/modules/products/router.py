from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.modules.users.models import User
from app.modules.products.schemas import CatalogueResponse
from app.modules.products.service import get_retailer_catalogue

router = APIRouter(prefix="/products", tags=["Products"])


@router.get(
    "/catalogue",
    response_model=CatalogueResponse,
)
def get_catalogue(
    search: str | None = Query(default=None, max_length=100),
    category: str | None = Query(default=None, max_length=80),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("RETAILER")),
):
    try:
        return get_retailer_catalogue(
            db=db,
            user_id=current_user.id,
            search=search,
            category=category,
            page=page,
            page_size=page_size,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=403,
            detail=str(exc),
        ) from exc