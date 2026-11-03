
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.modules.users.models import User
from app.modules.retailers.models import Retailer, RetailerUser
from app.modules.orders.models import Order, OrderItem
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
