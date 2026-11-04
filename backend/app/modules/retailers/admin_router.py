from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.modules.credit.models import CreditAccount, CreditTransaction
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
