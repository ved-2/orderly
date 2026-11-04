from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.modules.credit.models import CreditAccount
from app.modules.inventory.models import Inventory, Warehouse
from app.modules.orders.models import Order, OrderItem, OrderStatusHistory
from app.modules.orders.schemas import OrderCreate
from app.modules.orders.service import create_order_draft
from app.modules.pricing.default_price_models import DistributorProductPrice
from app.modules.products.models import Brand, Product
from app.modules.retailers.models import Retailer, RetailerAssignment
from app.modules.schemes.models import Scheme, SchemeRule
from app.modules.users.models import User

router = APIRouter(prefix="/salesman", tags=["Salesman - Mobile Portal"])


class BatchOrderSyncRequest(BaseModel):
    orders: List[OrderCreate] = Field(..., max_length=50)

    model_config = ConfigDict(extra="forbid")


@router.get("/retailers")
def get_salesman_assigned_retailers(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SALESMAN", "DISTRIBUTOR_ADMIN")),
):
    # 1. Determine assigned retailer IDs if specific assignments exist
    assigned_subquery = select(RetailerAssignment.retailer_id).where(
        RetailerAssignment.salesman_id == current_user.id
    )
    has_assignments = db.scalar(
        select(RetailerAssignment.id)
        .where(RetailerAssignment.salesman_id == current_user.id)
        .limit(1)
    )

    query = select(Retailer).where(
        Retailer.is_active.is_(True),
        Retailer.registration_status == "ACTIVE",
    )

    if has_assignments and current_user.role == "SALESMAN":
        query = query.where(Retailer.id.in_(assigned_subquery))

    if search:
        term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                Retailer.shop_name.ilike(term),
                Retailer.retailer_code.ilike(term),
                Retailer.owner_name.ilike(term),
                Retailer.city.ilike(term),
            )
        )

    retailers = db.scalars(query.order_by(Retailer.shop_name.asc())).all()
    if not retailers:
        return {"items": [], "total": 0}

    retailer_ids = [r.id for r in retailers]

    # Preload credit accounts
    credits = db.scalars(
        select(CreditAccount).where(CreditAccount.retailer_id.in_(retailer_ids))
    ).all()
    credit_map = {c.retailer_id: c for c in credits}

    # Preload pending orders count
    pending_orders = db.execute(
        select(Order.retailer_id)
        .where(
            Order.retailer_id.in_(retailer_ids),
            Order.status.in_(["SUBMITTED", "UNDER_REVIEW"]),
        )
    ).all()
    pending_counts = {}
    for r in pending_orders:
        pending_counts[r[0]] = pending_counts.get(r[0], 0) + 1

    items = []
    for r in retailers:
        c = credit_map.get(r.id)
        credit_limit = float(c.credit_limit) if c else 0.0
        outstanding = float(c.current_outstanding) if c else 0.0
        available = max(0.0, credit_limit - outstanding)
        terms = c.payment_terms_days if c else 7

        items.append({
            "id": str(r.id),
            "retailer_code": r.retailer_code,
            "shop_name": r.shop_name,
            "owner_name": r.owner_name,
            "phone": r.phone,
            "address": r.address,
            "city": r.city,
            "pincode": r.pincode,
            "credit_limit": credit_limit,
            "current_outstanding": outstanding,
            "available_credit": available,
            "payment_terms_days": terms,
            "pending_orders_count": pending_counts.get(r.id, 0),
        })

    return {"items": items, "total": len(items)}


@router.get("/catalogue")
def get_salesman_offline_catalogue(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SALESMAN", "DISTRIBUTOR_ADMIN")),
):
    """
    Returns the complete product catalogue with active wholesale prices and schemes.
    Designed for client-side local caching in IndexedDB for offline-first speed ordering.
    """
    warehouse = db.scalar(
        select(Warehouse)
        .where(Warehouse.is_active.is_(True))
        .order_by(Warehouse.created_at.asc())
    )

    now = datetime.now(timezone.utc)

    # Active products with brands
    query = (
        select(Product, Brand.name.label("brand_name"))
        .join(Brand, Brand.id == Product.brand_id)
        .where(Product.is_active.is_(True))
        .order_by(Product.category.asc(), Product.name.asc())
    )
    products_with_brands = db.execute(query).all()
    if not products_with_brands:
        return {"items": [], "total": 0, "cached_at": now.isoformat()}

    product_ids = [p.id for p, _ in products_with_brands]

    # Preload stock
    inv_map = {}
    if warehouse:
        invs = db.scalars(
            select(Inventory).where(
                Inventory.product_id.in_(product_ids),
                Inventory.warehouse_id == warehouse.id,
            )
        ).all()
        inv_map = {inv.product_id: inv for inv in invs}

    # Preload prices
    prices = db.scalars(
        select(DistributorProductPrice)
        .where(
            DistributorProductPrice.product_id.in_(product_ids),
            DistributorProductPrice.valid_from <= now,
            or_(
                DistributorProductPrice.valid_to.is_(None),
                DistributorProductPrice.valid_to > now,
            ),
        )
        .order_by(DistributorProductPrice.valid_from.desc())
    ).all()
    price_map = {}
    for pr in prices:
        if pr.product_id not in price_map:
            price_map[pr.product_id] = float(pr.price)

    # Preload active schemes
    scheme_rules = db.execute(
        select(SchemeRule, Scheme.name.label("scheme_name"), Scheme.scheme_type)
        .join(Scheme, Scheme.id == SchemeRule.scheme_id)
        .where(
            SchemeRule.product_id.in_(product_ids),
            Scheme.is_active.is_(True),
            Scheme.valid_from <= now,
            Scheme.valid_to > now,
        )
    ).all()

    scheme_map = {}
    for rule, scheme_name, scheme_type in scheme_rules:
        scheme_map.setdefault(rule.product_id, []).append({
            "scheme_name": scheme_name,
            "scheme_type": scheme_type,
            "buy_quantity": float(rule.buy_quantity) if rule.buy_quantity else None,
            "reward_quantity": float(rule.reward_quantity) if rule.reward_quantity else None,
            "min_quantity": float(rule.min_quantity) if rule.min_quantity else None,
            "discount_type": rule.discount_type,
            "discount_value": float(rule.discount_value) if rule.discount_value else None,
        })

    items = []
    for product, brand_name in products_with_brands:
        inv = inv_map.get(product.id)
        on_hand = float(inv.quantity_on_hand) if inv else 0.0
        reserved = float(inv.quantity_reserved) if inv else 0.0
        available = max(0.0, on_hand - reserved)

        items.append({
            "id": str(product.id),
            "sku": product.sku,
            "name": product.name,
            "description": product.description,
            "category": product.category,
            "brand_name": brand_name,
            "pack_size": float(product.pack_size),
            "pack_unit": product.pack_unit,
            "units_per_case": product.units_per_case,
            "hsn_code": product.hsn_code,
            "gst_rate": float(product.gst_rate) if product.gst_rate else None,
            "price": price_map.get(product.id, 0.0),
            "quantity_available": available,
            "schemes": scheme_map.get(product.id, []),
        })

    return {
        "items": items,
        "total": len(items),
        "cached_at": now.isoformat(),
    }


@router.post("/orders", status_code=status.HTTP_201_CREATED)
def create_salesman_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SALESMAN", "DISTRIBUTOR_ADMIN")),
):
    retailer = db.scalar(
        select(Retailer).where(
            Retailer.id == payload.retailer_id,
            Retailer.is_active.is_(True),
            Retailer.registration_status == "ACTIVE",
        )
    )
    if not retailer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active Kirana retailer not found.",
        )

    try:
        # Create draft with source="SALESMAN"
        order = create_order_draft(
            db=db,
            payload=payload,
            created_by=current_user.id,
            source="SALESMAN",
        )

        # Directly advance to SUBMITTED so Order Desk receives it
        if order.status == "DRAFT":
            now = datetime.now(timezone.utc)
            order.status = "SUBMITTED"
            order.submitted_at = now
            db.add(
                OrderStatusHistory(
                    order_id=order.id,
                    previous_status="DRAFT",
                    new_status="SUBMITTED",
                    changed_by=current_user.id,
                    note="Order captured and submitted via Salesman Mobile PWA.",
                )
            )
            db.commit()
            db.refresh(order)

        return {
            "id": str(order.id),
            "order_number": order.order_number,
            "retailer_id": str(order.retailer_id),
            "shop_name": retailer.shop_name,
            "status": order.status,
            "subtotal": float(order.subtotal),
            "discount_amount": float(order.discount_amount),
            "tax_amount": float(order.tax_amount),
            "total_amount": float(order.total_amount),
            "created_at": order.created_at,
            "submitted_at": order.submitted_at,
            "message": f"Order {order.order_number} submitted to Order Desk successfully.",
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post("/orders/sync")
def sync_offline_salesman_orders(
    payload: BatchOrderSyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SALESMAN", "DISTRIBUTOR_ADMIN")),
):
    """
    Receives an array of queued offline orders captured in local IndexedDB.
    Processes each idempotently and returns individual sync results.
    """
    synced = []
    failed = []

    for item in payload.orders:
        try:
            # Check idempotency first
            existing = db.scalar(
                select(Order).where(Order.idempotency_key == item.idempotency_key)
            )
            if existing:
                synced.append({
                    "idempotency_key": item.idempotency_key,
                    "order_id": str(existing.id),
                    "order_number": existing.order_number,
                    "total_amount": float(existing.total_amount),
                    "status": existing.status,
                    "is_duplicate": True,
                })
                continue

            order = create_order_draft(
                db=db,
                payload=item,
                created_by=current_user.id,
                source="SALESMAN",
            )
            now = datetime.now(timezone.utc)
            order.status = "SUBMITTED"
            order.submitted_at = now
            db.add(
                OrderStatusHistory(
                    order_id=order.id,
                    previous_status="DRAFT",
                    new_status="SUBMITTED",
                    changed_by=current_user.id,
                    note="Synced from Salesman offline queue.",
                )
            )
            db.commit()
            db.refresh(order)

            synced.append({
                "idempotency_key": item.idempotency_key,
                "order_id": str(order.id),
                "order_number": order.order_number,
                "total_amount": float(order.total_amount),
                "status": order.status,
                "is_duplicate": False,
            })
        except Exception as exc:
            db.rollback()
            failed.append({
                "idempotency_key": item.idempotency_key,
                "retailer_id": str(item.retailer_id),
                "error": str(exc),
            })

    return {
        "total_received": len(payload.orders),
        "synced_count": len(synced),
        "failed_count": len(failed),
        "synced": synced,
        "failed": failed,
    }


@router.get("/orders")
def get_salesman_orders_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SALESMAN", "DISTRIBUTOR_ADMIN")),
):
    query = (
        select(Order, Retailer.shop_name, Retailer.retailer_code)
        .join(Retailer, Retailer.id == Order.retailer_id)
        .order_by(Order.created_at.desc())
        .limit(50)
    )
    if current_user.role == "SALESMAN":
        query = query.where(Order.created_by == current_user.id)

    results = db.execute(query).all()
    if not results:
        return {"items": [], "total": 0}

    order_ids = [o.id for o, _, _ in results]
    lines_counts = {}
    item_rows = db.execute(
        select(OrderItem.order_id).where(OrderItem.order_id.in_(order_ids))
    ).all()
    for row in item_rows:
        lines_counts[row[0]] = lines_counts.get(row[0], 0) + 1

    items = []
    for order, shop_name, retailer_code in results:
        items.append({
            "id": str(order.id),
            "order_number": order.order_number,
            "retailer_id": str(order.retailer_id),
            "shop_name": shop_name,
            "retailer_code": retailer_code,
            "status": order.status,
            "total_amount": float(order.total_amount),
            "items_count": lines_counts.get(order.id, 0),
            "created_at": order.created_at,
            "submitted_at": order.submitted_at,
        })

    return {"items": items, "total": len(items)}
