from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.modules.products.models import Product
from app.modules.schemes.models import Scheme, SchemeRule
from app.modules.users.models import User

router = APIRouter(prefix="/distributor/schemes", tags=["Distributor - Schemes"])


class SchemeCreateRequest(BaseModel):
    code: str = Field(..., min_length=2, max_length=40)
    name: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = None
    scheme_type: Literal["BUY_X_GET_Y", "SLAB_DISCOUNT"]
    valid_from: datetime
    valid_to: datetime
    product_id: UUID
    quantity_unit: Literal["CASE", "PIECE"] = "CASE"

    # For BUY_X_GET_Y
    buy_quantity: Optional[Decimal] = Field(None, gt=0)
    reward_quantity: Optional[Decimal] = Field(None, gt=0)
    reward_product_id: Optional[UUID] = None

    # For SLAB_DISCOUNT
    min_quantity: Optional[Decimal] = Field(None, gt=0)
    discount_type: Optional[Literal["PERCENTAGE", "FIXED_AMOUNT"]] = None
    discount_value: Optional[Decimal] = Field(None, gt=0)


@router.get("")
def list_schemes(
    status_filter: Optional[str] = Query("ALL", regex="^(ALL|ACTIVE|INACTIVE)$"),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN")),
):
    query = select(Scheme)

    if status_filter == "ACTIVE":
        query = query.where(Scheme.is_active.is_(True))
    elif status_filter == "INACTIVE":
        query = query.where(Scheme.is_active.is_(False))

    if search:
        term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                Scheme.code.ilike(term),
                Scheme.name.ilike(term),
                Scheme.description.ilike(term),
            )
        )

    schemes = db.scalars(query.order_by(Scheme.created_at.desc())).all()
    if not schemes:
        return {"items": [], "total": 0}

    scheme_ids = [s.id for s in schemes]
    rules = db.scalars(
        select(SchemeRule).where(SchemeRule.scheme_id.in_(scheme_ids))
    ).all()

    # Preload product names
    product_ids = set()
    for r in rules:
        product_ids.add(r.product_id)
        if r.reward_product_id:
            product_ids.add(r.reward_product_id)

    products = db.scalars(
        select(Product).where(Product.id.in_(product_ids))
    ).all()
    prod_map = {p.id: p for p in products}

    rules_by_scheme = {}
    for r in rules:
        target_prod = prod_map.get(r.product_id)
        reward_prod = prod_map.get(r.reward_product_id) if r.reward_product_id else None

        rules_by_scheme.setdefault(r.scheme_id, []).append({
            "id": str(r.id),
            "tier_number": r.tier_number,
            "quantity_unit": r.quantity_unit,
            "product_id": str(r.product_id),
            "product_name": target_prod.name if target_prod else "Unknown",
            "product_sku": target_prod.sku if target_prod else "",
            "reward_product_id": str(r.reward_product_id) if r.reward_product_id else None,
            "reward_product_name": reward_prod.name if reward_prod else None,
            "reward_product_sku": reward_prod.sku if reward_prod else None,
            "buy_quantity": float(r.buy_quantity) if r.buy_quantity else None,
            "reward_quantity": float(r.reward_quantity) if r.reward_quantity else None,
            "min_quantity": float(r.min_quantity) if r.min_quantity else None,
            "discount_type": r.discount_type,
            "discount_value": float(r.discount_value) if r.discount_value else None,
        })

    items = []
    for s in schemes:
        items.append({
            "id": str(s.id),
            "code": s.code,
            "name": s.name,
            "description": s.description,
            "scheme_type": s.scheme_type,
            "valid_from": s.valid_from,
            "valid_to": s.valid_to,
            "applies_to_all_retailers": s.applies_to_all_retailers,
            "is_active": s.is_active,
            "created_at": s.created_at,
            "rules": rules_by_scheme.get(s.id, []),
        })

    return {"items": items, "total": len(items)}


@router.post("")
def create_scheme(
    payload: SchemeCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN")),
):
    clean_code = payload.code.strip().upper()

    existing = db.scalar(select(Scheme).where(Scheme.code == clean_code))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Scheme with code '{clean_code}' already exists.",
        )

    if payload.valid_to <= payload.valid_from:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="valid_to must be after valid_from.",
        )

    target_product = db.get(Product, payload.product_id)
    if not target_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target product not found.",
        )

    # Validate type specific fields
    if payload.scheme_type == "BUY_X_GET_Y":
        if not payload.buy_quantity or payload.buy_quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="buy_quantity must be greater than zero for BUY_X_GET_Y scheme.",
            )
        if not payload.reward_quantity or payload.reward_quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="reward_quantity must be greater than zero for BUY_X_GET_Y scheme.",
            )
        reward_product_id = payload.reward_product_id or payload.product_id
        if payload.reward_product_id:
            reward_prod = db.get(Product, payload.reward_product_id)
            if not reward_prod:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Reward product not found.",
                )

        rule = SchemeRule(
            product_id=payload.product_id,
            reward_product_id=reward_product_id,
            tier_number=1,
            quantity_unit=payload.quantity_unit,
            buy_quantity=payload.buy_quantity,
            reward_quantity=payload.reward_quantity,
            min_quantity=None,
            discount_type=None,
            discount_value=None,
        )
    elif payload.scheme_type == "SLAB_DISCOUNT":
        if not payload.min_quantity or payload.min_quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="min_quantity must be greater than zero for SLAB_DISCOUNT scheme.",
            )
        if not payload.discount_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="discount_type ('PERCENTAGE' or 'FIXED_AMOUNT') is required for SLAB_DISCOUNT scheme.",
            )
        if not payload.discount_value or payload.discount_value <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="discount_value must be greater than zero.",
            )
        if payload.discount_type == "PERCENTAGE" and payload.discount_value > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Percentage discount cannot exceed 100%.",
            )

        rule = SchemeRule(
            product_id=payload.product_id,
            reward_product_id=None,
            tier_number=1,
            quantity_unit=payload.quantity_unit,
            buy_quantity=None,
            reward_quantity=None,
            min_quantity=payload.min_quantity,
            discount_type=payload.discount_type,
            discount_value=payload.discount_value,
        )

    scheme = Scheme(
        code=clean_code,
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        scheme_type=payload.scheme_type,
        valid_from=payload.valid_from,
        valid_to=payload.valid_to,
        applies_to_all_retailers=True,
        is_active=True,
    )
    db.add(scheme)
    db.flush()

    rule.scheme_id = scheme.id
    db.add(rule)

    db.commit()
    db.refresh(scheme)

    return {
        "id": str(scheme.id),
        "code": scheme.code,
        "name": scheme.name,
        "scheme_type": scheme.scheme_type,
        "is_active": scheme.is_active,
        "message": f"Scheme '{scheme.name}' created successfully.",
    }


@router.post("/{scheme_id}/toggle-status")
def toggle_scheme_status(
    scheme_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN")),
):
    scheme = db.get(Scheme, scheme_id)
    if not scheme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheme not found.",
        )

    scheme.is_active = not scheme.is_active
    db.commit()
    db.refresh(scheme)

    status_str = "activated" if scheme.is_active else "disabled"
    return {
        "id": str(scheme.id),
        "is_active": scheme.is_active,
        "message": f"Scheme '{scheme.name}' has been {status_str}.",
    }


@router.delete("/{scheme_id}")
def delete_scheme(
    scheme_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN")),
):
    scheme = db.get(Scheme, scheme_id)
    if not scheme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheme not found.",
        )

    db.delete(scheme)
    db.commit()
    return {"message": f"Scheme '{scheme.name}' has been deleted."}
