from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.modules.users.models import User
from app.modules.retailers.models import Retailer, RetailerUser
from app.modules.credit.models import CreditAccount
from app.modules.orders.models import (
    Order,
    OrderItem,
    OrderStatusHistory,
)
from app.modules.orders.schemas import OrderCreate
from app.modules.orders.service import create_order_draft


router = APIRouter(prefix="/orders", tags=["Orders"])


@router.get("")
def list_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("RETAILER")),
):
    retailer_id = db.scalar(
        select(RetailerUser.retailer_id).where(
            RetailerUser.user_id == current_user.id
        )
    )

    if retailer_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No retailer account is linked to this user.",
        )

    orders = db.scalars(
        select(Order)
        .where(Order.retailer_id == retailer_id)
        .order_by(Order.created_at.desc())
    ).all()

    if not orders:
        return {"items": [], "total": 0}

    order_ids = [order.id for order in orders]
    order_items = db.scalars(
        select(OrderItem)
        .where(OrderItem.order_id.in_(order_ids))
        .order_by(OrderItem.created_at.asc())
    ).all()

    items_by_order: dict = {}
    for order_item in order_items:
        items_by_order.setdefault(order_item.order_id, []).append(
            {
                "product_id": order_item.product_id,
                "product_name": order_item.product_name,
                "sku": order_item.sku,
                "quantity": order_item.quantity,
                "quantity_unit": order_item.quantity_unit,
                "free_quantity": order_item.free_quantity,
                "unit_price": order_item.unit_price,
                "discount_amount": order_item.discount_amount,
                "tax_amount": order_item.tax_amount,
                "line_total": order_item.line_total,
            }
        )

    return {
        "items": [
            {
                "id": order.id,
                "order_number": order.order_number,
                "status": order.status,
                "subtotal": order.subtotal,
                "discount_amount": order.discount_amount,
                "tax_amount": order.tax_amount,
                "total_amount": order.total_amount,
                "customer_note": order.customer_note,
                "created_at": order.created_at,
                "submitted_at": order.submitted_at,
                "lines": items_by_order.get(order.id, []),
            }
            for order in orders
        ],
        "total": len(orders),
    }


@router.post("/drafts", status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("RETAILER")),
):
    # Verify that the authenticated user belongs to the requested retailer.
    retailer = db.scalar(
        select(Retailer)
        .join(
            RetailerUser,
            RetailerUser.retailer_id == Retailer.id,
        )
        .where(
            RetailerUser.user_id == current_user.id,
            Retailer.id == payload.retailer_id,
        )
    )

    if retailer is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorised to place orders for this retailer.",
        )

    if not retailer.is_active or retailer.registration_status in {
        "REJECTED",
        "SUSPENDED",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This retailer account cannot place orders.",
        )

    try:
        order = create_order_draft(
            db=db,
            payload=payload,
            created_by=current_user.id,
        )

        return {
            "id": order.id,
            "order_number": order.order_number,
            "status": order.status,
            "subtotal": order.subtotal,
            "discount_amount": order.discount_amount,
            "tax_amount": order.tax_amount,
            "total_amount": order.total_amount,
            "created_at": order.created_at,
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post("/{order_id}/submit")
def submit_order(
    order_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("RETAILER")),
):
    try:
        # Lock the order row to prevent concurrent submissions.
        order = db.scalar(
            select(Order)
            .join(
                RetailerUser,
                RetailerUser.retailer_id == Order.retailer_id,
            )
            .where(
                Order.id == order_id,
                RetailerUser.user_id == current_user.id,
            )
            .with_for_update()
        )
        if order is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found or access denied.",
            )
        if order.status != "DRAFT":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Only DRAFT orders can be submitted. "
                    f"Current status: {order.status}."
                ),
            )

        retailer = db.get(Retailer, order.retailer_id)
        if (
            retailer is None
            or not retailer.is_active
            or retailer.registration_status in {"REJECTED", "SUSPENDED"}
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This retailer account cannot place orders.",
            )

        previous_status = order.status
        order.status = "SUBMITTED"
        order.submitted_at = datetime.now(timezone.utc)
        db.add(
            OrderStatusHistory(
                order_id=order.id,
                previous_status=previous_status,
                new_status=order.status,
                changed_by=current_user.id,
                note="Order submitted by retailer.",
            )
        )

        db.commit()
        db.refresh(order)

        return {
            "id": order.id,
            "order_number": order.order_number,
            "status": order.status,
            "submitted_at": order.submitted_at,
            "subtotal": order.subtotal,
            "discount_amount": order.discount_amount,
            "tax_amount": order.tax_amount,
            "total_amount": order.total_amount,
        }
    except Exception:
        db.rollback()
        raise


@router.get("/desk/pending")
def get_pending_orders(
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("ORDER_DESK", "DISTRIBUTOR_ADMIN")
    ),
):
    if limit < 1 or limit > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit must be between 1 and 100.",
        )
    if offset < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Offset cannot be negative.",
        )

    total = db.scalar(
        select(func.count())
        .select_from(Order)
        .where(Order.status == "SUBMITTED")
    ) or 0
    orders = db.scalars(
        select(Order)
        .where(Order.status == "SUBMITTED")
        .order_by(Order.submitted_at.asc(), Order.created_at.asc())
        .offset(offset)
        .limit(limit)
    ).all()
    if not orders:
        return {
            "items": [],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    order_ids = [order.id for order in orders]
    order_items = db.scalars(
        select(OrderItem)
        .where(OrderItem.order_id.in_(order_ids))
        .order_by(OrderItem.created_at.asc())
    ).all()

    retailer_ids = list({order.retailer_id for order in orders})
    retailers = db.scalars(
        select(Retailer).where(Retailer.id.in_(retailer_ids))
    ).all()
    retailers_by_id = {r.id: r for r in retailers}

    items_by_order: dict = {}
    for order_item in order_items:
        items_by_order.setdefault(order_item.order_id, []).append(
            {
                "product_id": order_item.product_id,
                "product_name": order_item.product_name,
                "sku": order_item.sku,
                "quantity": order_item.quantity,
                "quantity_unit": order_item.quantity_unit,
                "free_quantity": order_item.free_quantity,
                "unit_price": float(order_item.unit_price),
                "discount_amount": float(order_item.discount_amount),
                "tax_amount": float(order_item.tax_amount),
                "line_total": float(order_item.line_total),
            }
        )

    return {
        "items": [
            {
                "id": order.id,
                "order_number": order.order_number,
                "retailer_id": order.retailer_id,
                "shop_name": (
                    retailers_by_id[order.retailer_id].shop_name
                    if order.retailer_id in retailers_by_id
                    else None
                ),
                "retailer_code": (
                    retailers_by_id[order.retailer_id].retailer_code
                    if order.retailer_id in retailers_by_id
                    else None
                ),
                "status": order.status,
                "subtotal": float(order.subtotal),
                "discount_amount": float(order.discount_amount),
                "tax_amount": float(order.tax_amount),
                "total_amount": float(order.total_amount),
                "customer_note": order.customer_note,
                "created_at": order.created_at,
                "submitted_at": order.submitted_at,
                "lines": items_by_order.get(order.id, []),
            }
            for order in orders
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/desk/{order_id}")
def get_desk_order_detail(
    order_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("ORDER_DESK", "DISTRIBUTOR_ADMIN")
    ),
):
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    retailer = db.get(Retailer, order.retailer_id)
    credit = db.scalar(
        select(CreditAccount).where(
            CreditAccount.retailer_id == order.retailer_id
        )
    )

    order_items = db.scalars(
        select(OrderItem)
        .where(OrderItem.order_id == order.id)
        .order_by(OrderItem.created_at.asc())
    ).all()

    history_entries = db.scalars(
        select(OrderStatusHistory)
        .where(OrderStatusHistory.order_id == order.id)
        .order_by(OrderStatusHistory.created_at.asc())
    ).all()

    return {
        "order": {
            "id": order.id,
            "order_number": order.order_number,
            "retailer_id": order.retailer_id,
            "status": order.status,
            "source": order.source,
            "subtotal": float(order.subtotal),
            "discount_amount": float(order.discount_amount),
            "tax_amount": float(order.tax_amount),
            "total_amount": float(order.total_amount),
            "customer_note": order.customer_note,
            "created_at": order.created_at,
            "submitted_at": order.submitted_at,
            "approved_at": order.approved_at,
            "dispatched_at": order.dispatched_at,
        },
        "retailer": {
            "id": retailer.id,
            "retailer_code": retailer.retailer_code,
            "shop_name": retailer.shop_name,
            "owner_name": retailer.owner_name,
            "phone": retailer.phone,
            "address": retailer.address,
            "city": retailer.city,
            "state": retailer.state,
            "pincode": retailer.pincode,
            "registration_status": retailer.registration_status,
            "is_active": retailer.is_active,
        } if retailer else None,
        "credit": {
            "credit_limit": float(credit.credit_limit),
            "current_outstanding": float(credit.current_outstanding),
            "available_credit": float(
                max(0, credit.credit_limit - credit.current_outstanding)
            ),
            "payment_terms_days": credit.payment_terms_days,
        } if credit else None,
        "items": [
            {
                "id": item.id,
                "product_id": item.product_id,
                "product_name": item.product_name,
                "sku": item.sku,
                "quantity": item.quantity,
                "quantity_unit": item.quantity_unit,
                "free_quantity": item.free_quantity,
                "unit_price": float(item.unit_price),
                "discount_amount": float(item.discount_amount),
                "tax_amount": float(item.tax_amount),
                "line_total": float(item.line_total),
            }
            for item in order_items
        ],
        "history": [
            {
                "id": h.id,
                "previous_status": h.previous_status,
                "new_status": h.new_status,
                "note": h.note,
                "created_at": h.created_at,
            }
            for h in history_entries
        ],
    }


@router.post("/desk/{order_id}/start-review")
def start_order_review(
    order_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("ORDER_DESK", "DISTRIBUTOR_ADMIN")
    ),
):
    try:
        order = db.scalar(
            select(Order)
            .where(Order.id == order_id)
            .with_for_update()
        )
        if order is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found.",
            )

        # Idempotent if already UNDER_REVIEW
        if order.status == "UNDER_REVIEW":
            return {
                "id": order.id,
                "order_number": order.order_number,
                "status": order.status,
                "message": "Order is already under review.",
            }

        if order.status != "SUBMITTED":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Cannot start review on order with status '{order.status}'. "
                    "Only SUBMITTED orders can be placed under review."
                ),
            )

        previous_status = order.status
        order.status = "UNDER_REVIEW"

        db.add(
            OrderStatusHistory(
                order_id=order.id,
                previous_status=previous_status,
                new_status=order.status,
                changed_by=current_user.id,
                note="Order review initiated by staff.",
            )
        )

        db.commit()
        db.refresh(order)

        return {
            "id": order.id,
            "order_number": order.order_number,
            "status": order.status,
            "message": "Order is now under review.",
        }
    except Exception:
        db.rollback()
        raise
