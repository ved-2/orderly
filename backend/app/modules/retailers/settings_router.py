import uuid
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.modules.retailers.models import (
    Retailer,
    RetailerAssignment,
    RetailerUser,
)
from app.modules.retailers.settings_model import RetailerSettings
from app.modules.users.models import User

router = APIRouter(prefix="/settings", tags=["Retailer Settings"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ProfileUpdateRequest(BaseModel):
    shop_name: Optional[str] = Field(None, min_length=2, max_length=150)
    owner_name: Optional[str] = Field(None, min_length=2, max_length=120)
    address: Optional[str] = Field(None, min_length=5, max_length=300)
    city: Optional[str] = Field(None, min_length=2, max_length=100)
    state: Optional[str] = Field(None, min_length=2, max_length=100)
    pincode: Optional[str] = Field(None, pattern=r"^[0-9]{6}$")
    gstin: Optional[str] = Field(None, max_length=20)

    model_config = ConfigDict(extra="forbid")


class PreferencesUpdateRequest(BaseModel):
    language: Optional[Literal["en", "hi"]] = None
    order_notifications: Optional[bool] = None
    order_confirmation_notifications: Optional[bool] = None
    delivery_notifications: Optional[bool] = None
    account_notifications: Optional[bool] = None
    promotional_notifications: Optional[bool] = None

    model_config = ConfigDict(extra="forbid")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_authenticated_retailer(db: Session, user: User) -> Retailer:
    retailer = db.scalar(
        select(Retailer)
        .join(RetailerUser, RetailerUser.retailer_id == Retailer.id)
        .where(RetailerUser.user_id == user.id)
    )
    if not retailer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No retailer account is linked to this authenticated user.",
        )
    return retailer


def get_or_create_settings(db: Session, retailer_id: uuid.UUID) -> RetailerSettings:
    try:
        RetailerSettings.__table__.create(bind=db.get_bind(), checkfirst=True)
    except Exception:
        pass

    settings = db.scalar(
        select(RetailerSettings).where(RetailerSettings.retailer_id == retailer_id)
    )
    if not settings:
        settings = RetailerSettings(
            retailer_id=retailer_id,
            language="en",
            order_notifications=True,
            order_confirmation_notifications=True,
            delivery_notifications=True,
            account_notifications=True,
            promotional_notifications=True,
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
def get_all_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("RETAILER")),
):
    retailer = get_authenticated_retailer(db, current_user)
    settings = get_or_create_settings(db, retailer.id)

    # Salesman
    assignment = db.scalar(
        select(RetailerAssignment).where(RetailerAssignment.retailer_id == retailer.id)
    )
    salesman_data = None
    if assignment:
        salesman = db.scalar(select(User).where(User.id == assignment.salesman_id))
        if salesman:
            salesman_data = {
                "name": salesman.email.split("@")[0].replace(".", " ").title(),
                "phone": salesman.phone,
                "email": salesman.email,
                "assigned_at": assignment.assigned_at.isoformat(),
            }

    return {
        "profile": {
            "retailer_id": str(retailer.id),
            "retailer_code": retailer.retailer_code,
            "shop_name": retailer.shop_name,
            "owner_name": retailer.owner_name,
            "phone": current_user.phone or retailer.phone,
            "email": current_user.email,
            "address": retailer.address,
            "city": retailer.city,
            "state": retailer.state,
            "pincode": retailer.pincode,
            "gstin": settings.gstin,
            "account_status": retailer.registration_status,
            "is_active": retailer.is_active,
        },
        "preferences": {
            "language": settings.language,
            "order_notifications": settings.order_notifications,
            "order_confirmation_notifications": settings.order_confirmation_notifications,
            "delivery_notifications": settings.delivery_notifications,
            "account_notifications": settings.account_notifications,
            "promotional_notifications": settings.promotional_notifications,
        },
        "salesman": {
            "assigned": salesman_data is not None,
            "salesman": salesman_data,
        },
        "security": {
            "registered_phone": current_user.phone or retailer.phone,
            "registered_email": current_user.email,
            "role": current_user.role,
            "account_created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        },
    }


@router.get("/profile")
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("RETAILER")),
):
    retailer = get_authenticated_retailer(db, current_user)
    settings = get_or_create_settings(db, retailer.id)

    return {
        "retailer_id": str(retailer.id),
        "retailer_code": retailer.retailer_code,
        "shop_name": retailer.shop_name,
        "owner_name": retailer.owner_name,
        "phone": current_user.phone or retailer.phone,
        "email": current_user.email,
        "address": retailer.address,
        "city": retailer.city,
        "state": retailer.state,
        "pincode": retailer.pincode,
        "gstin": settings.gstin,
        "account_status": retailer.registration_status,
        "is_active": retailer.is_active,
    }


@router.patch("/profile")
def update_profile(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("RETAILER")),
):
    retailer = get_authenticated_retailer(db, current_user)
    settings = get_or_create_settings(db, retailer.id)

    if payload.shop_name is not None:
        retailer.shop_name = payload.shop_name.strip()
    if payload.owner_name is not None:
        retailer.owner_name = payload.owner_name.strip()
    if payload.address is not None:
        retailer.address = payload.address.strip()
    if payload.city is not None:
        retailer.city = payload.city.strip()
    if payload.state is not None:
        retailer.state = payload.state.strip()
    if payload.pincode is not None:
        retailer.pincode = payload.pincode.strip()
    if payload.gstin is not None:
        settings.gstin = payload.gstin.strip().upper() if payload.gstin.strip() else None

    db.commit()
    db.refresh(retailer)
    db.refresh(settings)

    return {
        "success": True,
        "message": "Shop profile updated successfully.",
        "profile": {
            "retailer_id": str(retailer.id),
            "retailer_code": retailer.retailer_code,
            "shop_name": retailer.shop_name,
            "owner_name": retailer.owner_name,
            "phone": current_user.phone or retailer.phone,
            "email": current_user.email,
            "address": retailer.address,
            "city": retailer.city,
            "state": retailer.state,
            "pincode": retailer.pincode,
            "gstin": settings.gstin,
            "account_status": retailer.registration_status,
            "is_active": retailer.is_active,
        },
    }


@router.get("/preferences")
def get_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("RETAILER")),
):
    retailer = get_authenticated_retailer(db, current_user)
    settings = get_or_create_settings(db, retailer.id)

    return {
        "language": settings.language,
        "order_notifications": settings.order_notifications,
        "order_confirmation_notifications": settings.order_confirmation_notifications,
        "delivery_notifications": settings.delivery_notifications,
        "account_notifications": settings.account_notifications,
        "promotional_notifications": settings.promotional_notifications,
    }


@router.patch("/preferences")
def update_preferences(
    payload: PreferencesUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("RETAILER")),
):
    retailer = get_authenticated_retailer(db, current_user)
    settings = get_or_create_settings(db, retailer.id)

    if payload.language is not None:
        settings.language = payload.language
    if payload.order_notifications is not None:
        settings.order_notifications = payload.order_notifications
    if payload.order_confirmation_notifications is not None:
        settings.order_confirmation_notifications = payload.order_confirmation_notifications
    if payload.delivery_notifications is not None:
        settings.delivery_notifications = payload.delivery_notifications
    if payload.account_notifications is not None:
        settings.account_notifications = payload.account_notifications
    if payload.promotional_notifications is not None:
        settings.promotional_notifications = payload.promotional_notifications

    db.commit()
    db.refresh(settings)

    return {
        "success": True,
        "message": "Preferences saved successfully.",
        "preferences": {
            "language": settings.language,
            "order_notifications": settings.order_notifications,
            "order_confirmation_notifications": settings.order_confirmation_notifications,
            "delivery_notifications": settings.delivery_notifications,
            "account_notifications": settings.account_notifications,
            "promotional_notifications": settings.promotional_notifications,
        },
    }


@router.get("/salesman")
def get_salesman(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("RETAILER")),
):
    retailer = get_authenticated_retailer(db, current_user)

    assignment = db.scalar(
        select(RetailerAssignment).where(RetailerAssignment.retailer_id == retailer.id)
    )
    if not assignment:
        return {
            "assigned": False,
            "salesman": None,
            "message": "No field salesman assigned yet. Your routine orders are serviced directly by Jabalpur Central Depot.",
        }

    salesman = db.scalar(select(User).where(User.id == assignment.salesman_id))
    if not salesman:
        return {
            "assigned": False,
            "salesman": None,
            "message": "Assigned representative record not found.",
        }

    return {
        "assigned": True,
        "salesman": {
            "name": salesman.email.split("@")[0].replace(".", " ").title(),
            "phone": salesman.phone or "+91 761 240 8890",
            "email": salesman.email,
            "assigned_at": assignment.assigned_at.isoformat(),
        },
    }


@router.get("/security")
def get_security_info(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("RETAILER")),
):
    retailer = get_authenticated_retailer(db, current_user)

    return {
        "registered_phone": current_user.phone or retailer.phone,
        "registered_email": current_user.email,
        "role": current_user.role,
        "auth_provider": "FIREBASE_PHONE" if current_user.phone else "FIREBASE_EMAIL",
        "account_status": retailer.registration_status,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        "session_active": True,
    }


@router.post("/logout")
def logout(
    current_user: User = Depends(require_roles("RETAILER")),
):
    return {
        "success": True,
        "message": "Session terminated successfully.",
    }
