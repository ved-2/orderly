from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import (
    get_db,
    get_verified_firebase_identity,
)
from app.modules.retailers.registration_service import (
    register_retailer,
)
from app.modules.retailers.schemas import (
    RetailerRegistrationRequest,
    RetailerRegistrationResponse,
)


router = APIRouter(prefix="/retailers", tags=["Retailer Registration"])


@router.post(
    "/register",
    response_model=RetailerRegistrationResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: RetailerRegistrationRequest,
    identity: dict = Depends(get_verified_firebase_identity),
    db: Session = Depends(get_db),
):
    try:
        return register_retailer(
            db=db,
            identity=identity,
            payload=payload,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A retailer account with these details already exists.",
        ) from exc
