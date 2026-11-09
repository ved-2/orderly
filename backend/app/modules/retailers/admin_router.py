from datetime import datetime, timezone, timedelta
from decimal import Decimal
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.modules.credit.models import CreditAccount, CreditTransaction
from app.modules.orders.models import Order
from app.modules.retailers.models import Retailer
from app.modules.retailers.schemas import (
    CreditLimitUpdateRequest,
    RetailerPaymentRequest,
    RetailerVerifyRequest,
)
from app.modules.users.models import User

router = APIRouter(prefix="/distributor/retailers", tags=["Distributor - Retailers"])


@router.get("")
def list_retailers_for_admin(
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN")),
):
    query = select(Retailer)
    count_query = select(func.count()).select_from(Retailer)

    if status_filter:
        query = query.where(Retailer.registration_status == status_filter.upper())
        count_query = count_query.where(Retailer.registration_status == status_filter.upper())

    if search and search.strip():
        term = f"%{search.strip()}%"
        search_filter = or_(
            Retailer.shop_name.ilike(term),
            Retailer.owner_name.ilike(term),
            Retailer.phone.ilike(term),
            Retailer.retailer_code.ilike(term),
            Retailer.city.ilike(term),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    total = db.scalar(count_query) or 0
    retailers = db.scalars(
        query.order_by(Retailer.created_at.desc()).offset(offset).limit(limit)
    ).all()

    if not retailers:
        return {
            "items": [],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    retailer_ids = [r.id for r in retailers]
    credit_accounts = db.scalars(
        select(CreditAccount).where(CreditAccount.retailer_id.in_(retailer_ids))
    ).all()
    credit_by_retailer = {c.retailer_id: c for c in credit_accounts}

    return {
        "items": [
            {
                "id": str(r.id),
                "retailer_code": r.retailer_code,
                "shop_name": r.shop_name,
                "owner_name": r.owner_name,
                "phone": r.phone,
                "address": r.address,
                "city": r.city,
                "state": r.state,
                "pincode": r.pincode,
                "registration_status": r.registration_status,
                "is_active": r.is_active,
                "created_at": r.created_at,
                "credit": {
                    "credit_limit": float(credit_by_retailer[r.id].credit_limit),
                    "current_outstanding": float(credit_by_retailer[r.id].current_outstanding),
                    "available_credit": float(
                        max(
                            Decimal(0),
                            credit_by_retailer[r.id].credit_limit
                            - credit_by_retailer[r.id].current_outstanding,
                        )
                    ),
                    "payment_terms_days": credit_by_retailer[r.id].payment_terms_days,
                }
                if r.id in credit_by_retailer
                else None,
            }
            for r in retailers
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/dormant")
def list_dormant_retailers(
    days: int = Query(default=14, ge=1, description="Number of days of inactivity to qualify as dormant"),
    city: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN", "ORDER_DESK")),
):
    """
    Dashboard of retailers with no order in the last X days (default: 14 days).
    Calculates days inactive, last order date, current outstanding credit balance,
    and provides pre-formatted WhatsApp re-engagement links.
    """
    now = datetime.now(timezone.utc)

    # 1. Base query for active retailers
    ret_query = select(Retailer).where(
        Retailer.is_active.is_(True),
        Retailer.registration_status == "ACTIVE",
    )
    if city and city.strip():
        ret_query = ret_query.where(func.lower(Retailer.city) == city.strip().lower())

    active_retailers = db.scalars(ret_query).all()
    if not active_retailers:
        return {
            "summary": {
                "total_active_retailers": 0,
                "total_dormant_retailers": 0,
                "dormancy_rate_percentage": 0.0,
                "threshold_days": days,
                "total_outstanding_at_risk": 0.0,
            },
            "items": [],
            "total": 0,
            "limit": limit,
            "offset": offset,
        }

    active_retailer_ids = [r.id for r in active_retailers]

    # 2. Get latest valid order for each retailer (excluding CANCELLED / REJECTED)
    orders_stmt = (
        select(
            Order.retailer_id,
            func.max(Order.created_at).label("last_order_at"),
        )
        .where(
            Order.retailer_id.in_(active_retailer_ids),
            Order.status.not_in(["CANCELLED", "REJECTED"]),
        )
        .group_by(Order.retailer_id)
    )
    last_orders_rows = db.execute(orders_stmt).all()
    last_order_map = {row.retailer_id: row.last_order_at for row in last_orders_rows}

    # 3. Fetch recent orders to get last order number and amount
    recent_orders = (
        db.scalars(
            select(Order)
            .where(
                Order.retailer_id.in_(active_retailer_ids),
                Order.status.not_in(["CANCELLED", "REJECTED"]),
            )
            .order_by(Order.created_at.desc())
        ).all()
    )
    latest_order_obj_map: dict[UUID, Order] = {}
    for o in recent_orders:
        if o.retailer_id not in latest_order_obj_map:
            latest_order_obj_map[o.retailer_id] = o

    # 4. Fetch credit accounts
    credit_accounts = db.scalars(
        select(CreditAccount).where(CreditAccount.retailer_id.in_(active_retailer_ids))
    ).all()
    credit_map = {c.retailer_id: c for c in credit_accounts}

    # 5. Evaluate dormancy
    dormant_list = []
    total_risk_outstanding = Decimal("0")

    for r in active_retailers:
        last_dt = last_order_map.get(r.id)
        last_order = latest_order_obj_map.get(r.id)
        credit = credit_map.get(r.id)
        current_out = credit.current_outstanding if credit else Decimal("0")
        credit_lim = credit.credit_limit if credit else Decimal("0")

        is_dormant = False
        days_inactive = 0

        if last_dt is not None:
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            delta = now - last_dt
            days_inactive = max(0, delta.days)
            if delta.days >= days:
                is_dormant = True
        else:
            reg_dt = r.created_at
            if reg_dt.tzinfo is None:
                reg_dt = reg_dt.replace(tzinfo=timezone.utc)
            delta = now - reg_dt
            days_inactive = max(0, delta.days)
            if delta.days >= days:
                is_dormant = True

        if is_dormant:
            total_risk_outstanding += current_out
            clean_phone = "".join(filter(str.isdigit, r.phone or ""))
            if clean_phone.startswith("91") and len(clean_phone) > 10:
                pass
            elif len(clean_phone) == 10:
                clean_phone = f"91{clean_phone}"

            wa_text = (
                f"Namaste {r.owner_name} ji ({r.shop_name}), Orderly wholesale desk se sampark kar rahe hain. "
                f"Aapka pichle {days_inactive} dino se koi order nahi aaya. Naye schemes aur rates app me update ho gaye hain. "
                f"Kya aapko kisi stock ki zaroorat hai?"
            )
            whatsapp_url = f"https://wa.me/{clean_phone}?text={quote(wa_text)}"

            dormant_list.append({
                "retailer_id": str(r.id),
                "retailer_code": r.retailer_code,
                "shop_name": r.shop_name,
                "owner_name": r.owner_name,
                "phone": r.phone,
                "city": r.city,
                "address": r.address,
                "days_inactive": days_inactive,
                "last_order_date": last_dt.isoformat() if last_dt else None,
                "last_order_id": str(last_order.id) if last_order else None,
                "last_order_number": last_order.order_number if last_order else None,
                "last_order_amount": float(last_order.total_amount) if last_order else None,
                "credit_limit": float(credit_lim),
                "current_outstanding": float(current_out),
                "whatsapp_url": whatsapp_url,
            })

    dormant_list.sort(key=lambda x: x["days_inactive"], reverse=True)

    total_dormant = len(dormant_list)
    total_active = len(active_retailers)
    dormancy_pct = round((total_dormant / total_active * 100), 1) if total_active > 0 else 0.0

    paginated_items = dormant_list[offset : offset + limit]

    return {
        "summary": {
            "total_active_retailers": total_active,
            "total_dormant_retailers": total_dormant,
            "dormancy_rate_percentage": dormancy_pct,
            "threshold_days": days,
            "total_outstanding_at_risk": float(total_risk_outstanding),
        },
        "items": paginated_items,
        "total": total_dormant,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{retailer_id}")
def get_retailer_detail_for_admin(
    retailer_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN")),
):
    retailer = db.get(Retailer, retailer_id)
    if retailer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Retailer not found.",
        )

    credit = db.scalar(
        select(CreditAccount).where(CreditAccount.retailer_id == retailer.id)
    )

    recent_transactions = []
    if credit:
        txs = db.scalars(
            select(CreditTransaction)
            .where(CreditTransaction.credit_account_id == credit.id)
            .order_by(CreditTransaction.created_at.desc())
            .limit(10)
        ).all()
        recent_transactions = [
            {
                "id": str(t.id),
                "transaction_type": t.transaction_type,
                "amount": float(t.amount),
                "reference_type": t.reference_type,
                "note": t.note,
                "created_at": t.created_at,
            }
            for t in txs
        ]

    return {
        "id": str(retailer.id),
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
        "created_at": retailer.created_at,
        "credit": {
            "credit_limit": float(credit.credit_limit),
            "current_outstanding": float(credit.current_outstanding),
            "available_credit": float(
                max(Decimal(0), credit.credit_limit - credit.current_outstanding)
            ),
            "payment_terms_days": credit.payment_terms_days,
        }
        if credit
        else None,
        "recent_transactions": recent_transactions,
    }


@router.post("/{retailer_id}/verify")
def verify_retailer(
    retailer_id: UUID,
    payload: RetailerVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN")),
):
    try:
        retailer = db.scalar(
            select(Retailer).where(Retailer.id == retailer_id).with_for_update()
        )
        if retailer is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Retailer not found.",
            )

        if payload.action == "APPROVE":
            retailer.registration_status = "ACTIVE"
            retailer.is_active = True

            credit = db.scalar(
                select(CreditAccount)
                .where(CreditAccount.retailer_id == retailer.id)
                .with_for_update()
            )
            initial_limit = payload.credit_limit if payload.credit_limit is not None else Decimal(0)
            terms_days = payload.payment_terms_days if payload.payment_terms_days is not None else 7

            if credit is None:
                credit = CreditAccount(
                    retailer_id=retailer.id,
                    credit_limit=initial_limit,
                    current_outstanding=Decimal(0),
                    payment_terms_days=terms_days,
                )
                db.add(credit)
            else:
                if payload.credit_limit is not None:
                    credit.credit_limit = payload.credit_limit
                if payload.payment_terms_days is not None:
                    credit.payment_terms_days = payload.payment_terms_days

        elif payload.action == "REJECT":
            retailer.registration_status = "REJECTED"
            retailer.is_active = False

        elif payload.action == "SUSPEND":
            retailer.registration_status = "SUSPENDED"
            retailer.is_active = False

        db.commit()
        db.refresh(retailer)

        return {
            "id": str(retailer.id),
            "retailer_code": retailer.retailer_code,
            "shop_name": retailer.shop_name,
            "registration_status": retailer.registration_status,
            "is_active": retailer.is_active,
            "message": f"Retailer status updated to {retailer.registration_status}.",
        }

    except Exception:
        db.rollback()
        raise


@router.post("/{retailer_id}/payments")
def record_retailer_payment(
    retailer_id: UUID,
    payload: RetailerPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN")),
):
    try:
        retailer = db.get(Retailer, retailer_id)
        if retailer is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Retailer not found.",
            )

        credit = db.scalar(
            select(CreditAccount)
            .where(CreditAccount.retailer_id == retailer_id)
            .with_for_update()
        )
        if credit is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Retailer has no active credit account.",
            )

        # Decrement outstanding balance
        credit.current_outstanding = max(
            Decimal(0), credit.current_outstanding - payload.amount
        )

        note_str = f"Payment received via {payload.payment_mode}."
        if payload.reference_note:
            note_str += f" Note: {payload.reference_note}"

        db.add(
            CreditTransaction(
                credit_account_id=credit.id,
                transaction_type="PAYMENT",
                amount=payload.amount,
                reference_type=payload.payment_mode,
                note=note_str,
                created_by=current_user.id,
            )
        )

        db.commit()
        db.refresh(credit)

        return {
            "retailer_id": str(retailer.id),
            "shop_name": retailer.shop_name,
            "payment_amount": float(payload.amount),
            "credit_limit": float(credit.credit_limit),
            "current_outstanding": float(credit.current_outstanding),
            "available_credit": float(
                max(Decimal(0), credit.credit_limit - credit.current_outstanding)
            ),
            "message": "Payment recorded successfully. Credit restored.",
        }

    except Exception:
        db.rollback()
        raise


@router.post("/{retailer_id}/credit-limit")
def update_credit_limit(
    retailer_id: UUID,
    payload: CreditLimitUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN")),
):
    try:
        retailer = db.get(Retailer, retailer_id)
        if retailer is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Retailer not found.",
            )

        credit = db.scalar(
            select(CreditAccount)
            .where(CreditAccount.retailer_id == retailer_id)
            .with_for_update()
        )

        if credit is None:
            credit = CreditAccount(
                retailer_id=retailer.id,
                credit_limit=payload.credit_limit,
                current_outstanding=Decimal(0),
                payment_terms_days=payload.payment_terms_days or 7,
            )
            db.add(credit)
        else:
            old_limit = credit.credit_limit
            credit.credit_limit = payload.credit_limit
            if payload.payment_terms_days is not None:
                credit.payment_terms_days = payload.payment_terms_days

            db.add(
                CreditTransaction(
                    credit_account_id=credit.id,
                    transaction_type="ADJUSTMENT",
                    amount=abs(payload.credit_limit - old_limit) or Decimal(1),
                    reference_type="ADMIN_ADJUSTMENT",
                    note=payload.note or f"Credit limit adjusted from Rs {old_limit} to Rs {payload.credit_limit}",
                    created_by=current_user.id,
                )
            )

        db.commit()
        db.refresh(credit)

        return {
            "retailer_id": str(retailer.id),
            "shop_name": retailer.shop_name,
            "credit_limit": float(credit.credit_limit),
            "current_outstanding": float(credit.current_outstanding),
            "available_credit": float(
                max(Decimal(0), credit.credit_limit - credit.current_outstanding)
            ),
            "payment_terms_days": credit.payment_terms_days,
            "message": "Credit limit updated successfully.",
        }

    except Exception:
        db.rollback()
        raise
