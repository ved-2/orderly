from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

import csv
import io
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.modules.users.models import User
from app.modules.retailers.models import Retailer, RetailerUser
from app.modules.credit.models import CreditAccount, CreditTransaction
from app.modules.inventory.models import (
    Warehouse,
    Inventory,
    InventoryTransaction,
)
from app.modules.products.models import Product
from app.modules.orders.models import (
    Order,
    OrderItem,
    OrderStatusHistory,
)
from app.modules.orders.schemas import (
    OrderCreate,
    OrderApproveRequest,
    OrderRejectRequest,
    OrderHoldRequest,
)
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

    product_ids = list({oi.product_id for oi in order_items})
    prods = db.scalars(select(Product).where(Product.id.in_(product_ids))).all() if product_ids else []
    prod_upc_map = {p.id: p.units_per_case for p in prods}

    items_by_order: dict = {}
    for order_item in order_items:
        upc = prod_upc_map.get(order_item.product_id, 1)
        items_by_order.setdefault(order_item.order_id, []).append(
            {
                "product_id": order_item.product_id,
                "product_name": order_item.product_name,
                "sku": order_item.sku,
                "quantity": order_item.quantity,
                "quantity_unit": order_item.quantity_unit,
                "units_per_case": upc,
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


@router.get("/desk")
def list_desk_orders(
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("ORDER_DESK", "DISTRIBUTOR_ADMIN")
    ),
):
    # Compute counts across key statuses for tab badges
    count_query = select(Order.status, func.count(Order.id)).group_by(Order.status)
    status_counts_rows = db.execute(count_query).all()
    counts = {
        "ALL": 0,
        "SUBMITTED": 0,
        "UNDER_REVIEW": 0,
        "ON_HOLD": 0,
        "APPROVED": 0,
        "REJECTED": 0,
        "DISPATCHED": 0,
    }
    for st, c in status_counts_rows:
        if st in counts:
            counts[st] = c
        counts["ALL"] += c

    query = select(Order)
    count_filtered_query = select(func.count()).select_from(Order)

    if status_filter and status_filter.upper() != "ALL":
        target_status = status_filter.upper()
        query = query.where(Order.status == target_status)
        count_filtered_query = count_filtered_query.where(Order.status == target_status)

    if search and search.strip():
        term = f"%{search.strip()}%"
        matching_retailer_ids = select(Retailer.id).where(
            or_(
                Retailer.shop_name.ilike(term),
                Retailer.retailer_code.ilike(term),
                Retailer.owner_name.ilike(term),
                Retailer.phone.ilike(term),
            )
        )
        search_condition = or_(
            Order.order_number.ilike(term),
            Order.retailer_id.in_(matching_retailer_ids),
        )
        query = query.where(search_condition)
        count_filtered_query = count_filtered_query.where(search_condition)

    total = db.scalar(count_filtered_query) or 0
    orders = db.scalars(
        query.order_by(Order.created_at.desc())
        .offset(offset)
        .limit(limit)
    ).all()

    if not orders:
        return {
            "items": [],
            "total": total,
            "limit": limit,
            "offset": offset,
            "counts": counts,
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

    credit_accounts = db.scalars(
        select(CreditAccount).where(CreditAccount.retailer_id.in_(retailer_ids))
    ).all()
    credit_by_retailer = {c.retailer_id: c for c in credit_accounts}

    items_by_order: dict = {}
    for order_item in order_items:
        items_by_order.setdefault(order_item.order_id, []).append(
            {
                "product_id": order_item.product_id,
                "product_name": order_item.product_name,
                "sku": order_item.sku,
                "quantity": float(order_item.quantity),
                "quantity_unit": order_item.quantity_unit,
                "free_quantity": float(order_item.free_quantity),
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
                "retailer_phone": (
                    retailers_by_id[order.retailer_id].phone
                    if order.retailer_id in retailers_by_id
                    else None
                ),
                "retailer_city": (
                    retailers_by_id[order.retailer_id].city
                    if order.retailer_id in retailers_by_id
                    else None
                ),
                "status": order.status,
                "source": order.source,
                "subtotal": float(order.subtotal),
                "discount_amount": float(order.discount_amount),
                "tax_amount": float(order.tax_amount),
                "total_amount": float(order.total_amount),
                "customer_note": order.customer_note,
                "desk_note": order.desk_note,
                "items_count": len(items_by_order.get(order.id, [])),
                "created_at": order.created_at,
                "submitted_at": order.submitted_at,
                "approved_at": order.approved_at,
                "lines": items_by_order.get(order.id, []),
                "credit": {
                    "credit_limit": float(credit_by_retailer[order.retailer_id].credit_limit),
                    "current_outstanding": float(credit_by_retailer[order.retailer_id].current_outstanding),
                    "available_credit": float(
                        max(0, credit_by_retailer[order.retailer_id].credit_limit - credit_by_retailer[order.retailer_id].current_outstanding)
                    ),
                } if order.retailer_id in credit_by_retailer else None,
            }
            for order in orders
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
        "counts": counts,
    }


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

    item_prod_ids = list({oi.product_id for oi in order_items})
    detail_prods = db.scalars(select(Product).where(Product.id.in_(item_prod_ids))).all() if item_prod_ids else []
    detail_upc_map = {p.id: p.units_per_case for p in detail_prods}

    warehouse = db.scalar(
        select(Warehouse)
        .where(Warehouse.is_active.is_(True))
        .order_by(Warehouse.created_at.asc())
    )

    inv_map = {}
    if warehouse and item_prod_ids:
        inv_records = db.scalars(
            select(Inventory).where(
                Inventory.warehouse_id == warehouse.id,
                Inventory.product_id.in_(item_prod_ids),
            )
        ).all()
        for inv in inv_records:
            inv_map[inv.product_id] = {
                "quantity_on_hand": float(inv.quantity_on_hand),
                "quantity_reserved": float(inv.quantity_reserved),
                "available_stock": float(
                    max(0, inv.quantity_on_hand - inv.quantity_reserved)
                ),
            }

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
            "desk_note": order.desk_note,
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
        "warehouse": {
            "id": warehouse.id,
            "code": warehouse.code,
            "name": warehouse.name,
            "city": warehouse.city,
        } if warehouse else None,
        "items": [
            {
                "id": item.id,
                "product_id": item.product_id,
                "product_name": item.product_name,
                "sku": item.sku,
                "quantity": float(item.quantity),
                "quantity_unit": item.quantity_unit,
                "units_per_case": detail_upc_map.get(item.product_id, 1),
                "case_price": float(item.unit_price) * detail_upc_map.get(item.product_id, 1),
                "free_quantity": float(item.free_quantity),
                "unit_price": float(item.unit_price),
                "discount_amount": float(item.discount_amount),
                "tax_amount": float(item.tax_amount),
                "line_total": float(item.line_total),
                "stock_on_hand": inv_map.get(item.product_id, {}).get("quantity_on_hand", 0.0),
                "stock_reserved": inv_map.get(item.product_id, {}).get("quantity_reserved", 0.0),
                "available_stock": inv_map.get(item.product_id, {}).get("available_stock", 0.0),
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

@router.post("/desk/{order_id}/approve")
def approve_order(
    order_id: UUID,
    request: OrderApproveRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("ORDER_DESK", "DISTRIBUTOR_ADMIN")
    ),
):
    desk_note = request.desk_note if request else None
    req_warehouse_id = request.warehouse_id if request else None

    try:
        # 1. Lock the order row to prevent race conditions
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

        if order.status == "APPROVED":
            return {
                "id": order.id,
                "order_number": order.order_number,
                "status": order.status,
                "approved_at": order.approved_at,
                "message": "Order is already approved.",
            }

        if order.status not in {"SUBMITTED", "UNDER_REVIEW", "ON_HOLD"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Cannot approve order with status '{order.status}'. "
                    "Only SUBMITTED, UNDER_REVIEW, or ON_HOLD orders can be approved."
                ),
            )

        # 2. Check and validate retailer status
        retailer = db.get(Retailer, order.retailer_id)
        if (
            retailer is None
            or not retailer.is_active
            or retailer.registration_status in {"REJECTED", "SUSPENDED"}
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Retailer account is inactive or suspended.",
            )

        # 3. Revalidate retailer credit account
        credit = db.scalar(
            select(CreditAccount)
            .where(CreditAccount.retailer_id == order.retailer_id)
            .with_for_update()
        )

        if credit:
            available_credit = credit.credit_limit - credit.current_outstanding
            if order.total_amount > available_credit:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Order total (Rs {order.total_amount:.2f}) exceeds available credit "
                        f"(Rs {available_credit:.2f})."
                    ),
                )

            # Deduct credit by incrementing current_outstanding
            credit.current_outstanding += order.total_amount
            db.add(
                CreditTransaction(
                    credit_account_id=credit.id,
                    transaction_type="ORDER_DEBIT",
                    amount=order.total_amount,
                    reference_type="ORDER",
                    reference_id=order.id,
                    note=f"Credit debit for approved order {order.order_number}",
                    created_by=current_user.id,
                )
            )

        # 4. Determine Warehouse for stock reservation
        if req_warehouse_id:
            warehouse = db.scalar(
                select(Warehouse).where(
                    Warehouse.id == req_warehouse_id,
                    Warehouse.is_active.is_(True),
                )
            )
            if warehouse is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Specified warehouse is not found or inactive.",
                )
        else:
            warehouse = db.scalar(
                select(Warehouse)
                .where(Warehouse.is_active.is_(True))
                .order_by(Warehouse.created_at.asc())
            )
            if warehouse is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No active warehouse found for inventory allocation.",
                )

        # 5. Fetch order items and reserve stock
        order_items = db.scalars(
            select(OrderItem)
            .where(OrderItem.order_id == order.id)
            .order_by(OrderItem.created_at.asc())
        ).all()

        if not order_items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Order contains no line items.",
            )

        for item in order_items:
            total_qty_needed = Decimal(str(item.quantity)) + Decimal(str(item.free_quantity))

            inventory = db.scalar(
                select(Inventory)
                .where(
                    Inventory.warehouse_id == warehouse.id,
                    Inventory.product_id == item.product_id,
                )
                .with_for_update()
            )

            available_stock = (
                (inventory.quantity_on_hand - inventory.quantity_reserved)
                if inventory
                else Decimal(0)
            )

            if inventory is None or available_stock < total_qty_needed:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Insufficient stock for '{item.product_name}' (SKU: {item.sku}). "
                        f"Required: {total_qty_needed}, Available: {available_stock} in '{warehouse.name}'."
                    ),
                )

            # Atomically reserve stock
            inventory.quantity_reserved += total_qty_needed
            db.add(
                InventoryTransaction(
                    warehouse_id=warehouse.id,
                    product_id=item.product_id,
                    movement_type="ORDER_RESERVE",
                    quantity_delta=total_qty_needed,
                    reference_type="ORDER",
                    reference_id=order.id,
                    note=(
                        f"Stock reserved for {order.order_number} "
                        f"({item.quantity} ordered + {item.free_quantity} scheme free)"
                    ),
                    created_by=current_user.id,
                )
            )

        # 6. Update Order Status
        previous_status = order.status
        order.status = "APPROVED"
        order.approved_at = datetime.now(timezone.utc)
        if desk_note:
            order.desk_note = desk_note

        db.add(
            OrderStatusHistory(
                order_id=order.id,
                previous_status=previous_status,
                new_status="APPROVED",
                changed_by=current_user.id,
                note=(
                    f"Order approved by Order Desk. "
                    f"Stock reserved in warehouse '{warehouse.name}'."
                    + (f" Note: {desk_note}" if desk_note else "")
                ),
            )
        )

        db.commit()
        db.refresh(order)

        return {
            "id": order.id,
            "order_number": order.order_number,
            "status": order.status,
            "approved_at": order.approved_at,
            "total_amount": float(order.total_amount),
            "warehouse_name": warehouse.name,
            "message": "Order approved successfully. Stock reserved.",
        }

    except Exception:
        db.rollback()
        raise


@router.post("/desk/{order_id}/reject")
def reject_order(
    order_id: UUID,
    request: OrderRejectRequest,
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

        if order.status == "REJECTED":
            return {
                "id": order.id,
                "order_number": order.order_number,
                "status": order.status,
                "message": "Order is already rejected.",
            }

        if order.status not in {"SUBMITTED", "UNDER_REVIEW", "ON_HOLD"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Cannot reject order with status '{order.status}'. "
                    "Only SUBMITTED, UNDER_REVIEW, or ON_HOLD orders can be rejected."
                ),
            )

        previous_status = order.status
        order.status = "REJECTED"
        order.desk_note = request.reason

        db.add(
            OrderStatusHistory(
                order_id=order.id,
                previous_status=previous_status,
                new_status="REJECTED",
                changed_by=current_user.id,
                note=f"Order rejected by Order Desk. Reason: {request.reason}",
            )
        )

        db.commit()
        db.refresh(order)

        return {
            "id": order.id,
            "order_number": order.order_number,
            "status": order.status,
            "rejection_reason": request.reason,
            "message": "Order has been rejected.",
        }

    except Exception:
        db.rollback()
        raise


@router.post("/desk/{order_id}/hold")
def hold_order(
    order_id: UUID,
    request: OrderHoldRequest,
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

        if order.status == "ON_HOLD":
            return {
                "id": order.id,
                "order_number": order.order_number,
                "status": order.status,
                "message": "Order is already on hold.",
            }

        if order.status not in {"SUBMITTED", "UNDER_REVIEW"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Cannot put order with status '{order.status}' on hold. "
                    "Only SUBMITTED or UNDER_REVIEW orders can be placed on hold."
                ),
            )

        previous_status = order.status
        order.status = "ON_HOLD"
        order.desk_note = request.reason

        db.add(
            OrderStatusHistory(
                order_id=order.id,
                previous_status=previous_status,
                new_status="ON_HOLD",
                changed_by=current_user.id,
                note=f"Order placed on hold by Order Desk. Reason: {request.reason}",
            )
        )

        db.commit()
        db.refresh(order)

        return {
            "id": order.id,
            "order_number": order.order_number,
            "status": order.status,
            "hold_reason": request.reason,
            "message": "Order has been placed on hold.",
        }
    except Exception:
        db.rollback()
        raise


@router.post("/desk/{order_id}/release-hold")
def release_order_hold(
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

        if order.status != "ON_HOLD":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Cannot release hold on order with status '{order.status}'. "
                    "Only ON_HOLD orders can be released."
                ),
            )

        previous_status = order.status
        order.status = "UNDER_REVIEW"

        db.add(
            OrderStatusHistory(
                order_id=order.id,
                previous_status=previous_status,
                new_status="UNDER_REVIEW",
                changed_by=current_user.id,
                note="Order released from hold by Order Desk and returned to review.",
            )
        )

        db.commit()
        db.refresh(order)

        return {
            "id": order.id,
            "order_number": order.order_number,
            "status": order.status,
            "message": "Order released from hold and is now under review.",
        }
    except Exception:
        db.rollback()
        raise

@router.get("/export/tally")
def export_orders_tally(
    status_filter: str = Query(default="APPROVED", alias="status"),
    start_date: str | None = None,
    end_date: str | None = None,
    format_type: str = Query(default="csv", alias="format"),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("DISTRIBUTOR_ADMIN", "ORDER_DESK")
    ),
):
    query = select(Order)
    if status_filter.upper() == "ALL":
        query = query.where(Order.status.in_(["APPROVED", "DISPATCHED"]))
    else:
        query = query.where(Order.status == status_filter.upper())

    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
            query = query.where(Order.created_at >= start_dt)
        except ValueError:
            pass

    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
            query = query.where(Order.created_at <= end_dt)
        except ValueError:
            pass

    orders = db.scalars(query.order_by(Order.approved_at.asc(), Order.created_at.asc())).all()

    if not orders:
        if format_type.lower() == "json":
            return {"items": [], "count": 0, "orders_count": 0}

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Voucher Number",
            "Voucher Date",
            "Party Name",
            "Retailer Code",
            "Item Name",
            "SKU",
            "Billed Qty",
            "Free Qty",
            "UOM",
            "Rate",
            "Discount",
            "Tax",
            "Amount",
            "Voucher Total",
            "City",
            "Address",
            "Status",
        ])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=tally_sales_export_empty.csv"},
        )

    order_ids = [o.id for o in orders]
    retailer_ids = list({o.retailer_id for o in orders})

    order_items = db.scalars(
        select(OrderItem)
        .where(OrderItem.order_id.in_(order_ids))
        .order_by(OrderItem.created_at.asc())
    ).all()
    items_by_order: dict = {}
    for item in order_items:
        items_by_order.setdefault(item.order_id, []).append(item)

    retailers = db.scalars(
        select(Retailer).where(Retailer.id.in_(retailer_ids))
    ).all()
    retailers_by_id = {r.id: r for r in retailers}

    rows = []
    for order in orders:
        ret = retailers_by_id.get(order.retailer_id)
        party_name = ret.shop_name if ret else f"Retailer {str(order.retailer_id)[:8]}"
        ret_code = ret.retailer_code if ret else ""
        city = ret.city if ret else ""
        address = ret.address if ret else ""
        v_date = (order.approved_at or order.submitted_at or order.created_at).strftime("%Y-%m-%d")

        lines = items_by_order.get(order.id, [])
        for line in lines:
            rows.append({
                "voucher_number": order.order_number,
                "voucher_date": v_date,
                "party_name": party_name,
                "retailer_code": ret_code,
                "item_name": line.product_name,
                "sku": line.sku,
                "billed_qty": float(line.quantity),
                "free_qty": float(line.free_quantity),
                "uom": line.quantity_unit,
                "rate": float(line.unit_price),
                "discount": float(line.discount_amount),
                "tax": float(line.tax_amount),
                "amount": float(line.line_total),
                "voucher_total": float(order.total_amount),
                "city": city,
                "address": address,
                "status": order.status,
            })

    if format_type.lower() == "json":
        return {
            "items": rows,
            "count": len(rows),
            "orders_count": len(orders),
        }

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Voucher Number",
        "Voucher Date",
        "Party Name",
        "Retailer Code",
        "Item Name",
        "SKU",
        "Billed Qty",
        "Free Qty",
        "UOM",
        "Rate",
        "Discount",
        "Tax",
        "Amount",
        "Voucher Total",
        "City",
        "Address",
        "Status",
    ])

    for r in rows:
        writer.writerow([
            r["voucher_number"],
            r["voucher_date"],
            r["party_name"],
            r["retailer_code"],
            r["item_name"],
            r["sku"],
            r["billed_qty"],
            r["free_qty"],
            r["uom"],
            r["rate"],
            r["discount"],
            r["tax"],
            r["amount"],
            r["voucher_total"],
            r["city"],
            r["address"],
            r["status"],
        ])

    output.seek(0)
    today_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    filename = f"tally_sales_export_{today_str}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
