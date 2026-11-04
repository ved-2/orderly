import csv
import io
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.modules.credit.models import CreditAccount, CreditTransaction
from app.modules.credit.schemas import (
    CreditLedgerResponse,
    CreditSummaryResponse,
    LedgerEntryItem,
    OutstandingInvoiceItem,
    RetailerInfo,
)
from app.modules.orders.models import Order
from app.modules.retailers.models import Retailer, RetailerUser
from app.modules.users.models import User

router = APIRouter(prefix="/retailer/credit", tags=["Retailer - Credit"])

IST = ZoneInfo("Asia/Kolkata")


def resolve_retailer(
    current_user: User,
    db: Session,
    requested_retailer_id: Optional[UUID] = None,
) -> Retailer:
    if current_user.role == "RETAILER":
        retailer_user = db.scalar(
            select(RetailerUser).where(RetailerUser.user_id == current_user.id)
        )
        if retailer_user is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No registered Kirana shop associated with this account.",
            )
        retailer = db.get(Retailer, retailer_user.retailer_id)
        if retailer is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Retailer shop profile not found.",
            )
        return retailer

    if current_user.role in ("DISTRIBUTOR_ADMIN", "ORDER_DESK", "SALESMAN"):
        if requested_retailer_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="retailer_id parameter is required for staff access.",
            )
        retailer = db.get(Retailer, requested_retailer_id)
        if retailer is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Requested retailer not found.",
            )
        return retailer

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Unauthorized to access retailer credit data.",
    )


def compute_credit_state(retailer: Retailer, db: Session):
    credit_account = db.scalar(
        select(CreditAccount).where(CreditAccount.retailer_id == retailer.id)
    )

    credit_limit = credit_account.credit_limit if credit_account else Decimal("0.00")
    current_outstanding = (
        credit_account.current_outstanding if credit_account else Decimal("0.00")
    )
    payment_terms_days = credit_account.payment_terms_days if credit_account else 7
    updated_at = credit_account.updated_at if credit_account else None

    available_credit = max(Decimal("0.00"), credit_limit - current_outstanding)

    if credit_limit > 0:
        utilization_pct = min(
            100.0,
            round(float((current_outstanding / credit_limit) * 100), 1),
        )
    else:
        utilization_pct = 0.0

    if credit_limit <= 0:
        account_status = "NOT_ASSIGNED"
    elif current_outstanding > credit_limit:
        account_status = "LIMIT_EXCEEDED"
    elif utilization_pct >= 80.0:
        account_status = "NEAR_LIMIT"
    else:
        account_status = "HEALTHY"

    # Load all transactions chronologically ascending to compute running balances
    txs = []
    if credit_account:
        txs = db.scalars(
            select(CreditTransaction)
            .where(CreditTransaction.credit_account_id == credit_account.id)
            .order_by(CreditTransaction.created_at.asc())
        ).all()

    # Preload order numbers for referenced orders
    order_ids = [
        tx.reference_id
        for tx in txs
        if tx.reference_id is not None and tx.reference_type == "ORDER"
    ]
    orders_map = {}
    if order_ids:
        rows = db.execute(
            select(Order.id, Order.order_number).where(Order.id.in_(order_ids))
        ).all()
        orders_map = {row[0]: row[1] for row in rows}

    running_bal = Decimal("0.00")
    total_debits = Decimal("0.00")
    total_payments = Decimal("0.00")
    enriched_txs = []

    for tx in txs:
        if tx.transaction_type == "ORDER_DEBIT":
            running_bal += tx.amount
            total_debits += tx.amount
        elif tx.transaction_type in ("PAYMENT", "CREDIT_NOTE"):
            running_bal = max(Decimal("0.00"), running_bal - tx.amount)
            total_payments += tx.amount
        elif tx.transaction_type == "ADJUSTMENT":
            # If note indicates credit or debit adjustment
            running_bal = max(Decimal("0.00"), running_bal)

        ref_number = orders_map.get(tx.reference_id) if tx.reference_id else None

        enriched_txs.append(
            {
                "id": tx.id,
                "transaction_type": tx.transaction_type,
                "amount": tx.amount,
                "reference_type": tx.reference_type,
                "reference_id": tx.reference_id,
                "reference_number": ref_number,
                "note": tx.note,
                "created_at": tx.created_at,
                "running_balance": running_bal,
            }
        )

    # Active outstanding approved/dispatched orders
    now = datetime.now(timezone.utc)
    outstanding_orders = db.scalars(
        select(Order)
        .where(
            Order.retailer_id == retailer.id,
            Order.status.in_(["APPROVED", "DISPATCHED"]),
        )
        .order_by(Order.approved_at.asc().nulls_last(), Order.created_at.asc())
    ).all()

    outstanding_invoices = []
    for o in outstanding_orders:
        ref_time = o.approved_at or o.created_at
        due_date = (
            ref_time + timedelta(days=payment_terms_days) if ref_time else None
        )
        is_overdue = (now > due_date) if due_date else False
        days_rem = (due_date - now).days if due_date else None

        outstanding_invoices.append(
            OutstandingInvoiceItem(
                order_id=o.id,
                order_number=o.order_number,
                total_amount=o.total_amount,
                approved_at=o.approved_at,
                due_date=due_date,
                days_remaining=days_rem,
                is_overdue=is_overdue,
            )
        )

    summary = CreditSummaryResponse(
        retailer=RetailerInfo(
            id=retailer.id,
            shop_name=retailer.shop_name,
            owner_name=retailer.owner_name,
            retailer_code=retailer.retailer_code,
            phone=retailer.phone,
        ),
        credit_limit=credit_limit,
        current_outstanding=current_outstanding,
        available_credit=available_credit,
        utilization_percentage=utilization_pct,
        payment_terms_days=payment_terms_days,
        account_status=account_status,
        updated_at=updated_at,
        total_debits_amount=total_debits,
        total_payments_amount=total_payments,
        total_transactions_count=len(enriched_txs),
    )

    return summary, enriched_txs, outstanding_invoices


@router.get("/summary", response_model=CreditSummaryResponse)
def get_credit_summary(
    retailer_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    retailer = resolve_retailer(current_user, db, retailer_id)
    summary, _, _ = compute_credit_state(retailer, db)
    return summary


@router.get("/ledger", response_model=CreditLedgerResponse)
def get_credit_ledger(
    type: Optional[str] = Query(None, description="ALL, ORDER_DEBIT, PAYMENT, CREDIT_NOTE, ADJUSTMENT"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    retailer_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    retailer = resolve_retailer(current_user, db, retailer_id)
    summary, enriched_txs, outstanding_invoices = compute_credit_state(retailer, db)

    # Reverse chronologically (newest first)
    descending_txs = list(reversed(enriched_txs))

    if type and type.upper() != "ALL":
        filtered_txs = [
            tx for tx in descending_txs if tx["transaction_type"] == type.upper()
        ]
    else:
        filtered_txs = descending_txs

    total_count = len(filtered_txs)
    paged_txs = filtered_txs[offset : offset + limit]

    items = [
        LedgerEntryItem(
            id=tx["id"],
            transaction_type=tx["transaction_type"],
            amount=tx["amount"],
            reference_type=tx["reference_type"],
            reference_id=tx["reference_id"],
            reference_number=tx["reference_number"],
            note=tx["note"],
            created_at=tx["created_at"],
            running_balance=tx["running_balance"],
        )
        for tx in paged_txs
    ]

    return CreditLedgerResponse(
        summary=summary,
        items=items,
        outstanding_invoices=outstanding_invoices,
        total_count=total_count,
    )


@router.get("/export")
def export_credit_statement(
    retailer_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    retailer = resolve_retailer(current_user, db, retailer_id)
    summary, enriched_txs, _ = compute_credit_state(retailer, db)

    output = io.StringIO()
    writer = csv.writer(output)

    # Header section
    writer.writerow(["ORDERLY B2B FMCG - RETAILER CREDIT STATEMENT"])
    writer.writerow(["Kirana Shop Name", retailer.shop_name])
    writer.writerow(["Retailer Code", retailer.retailer_code])
    writer.writerow(["Owner Name", retailer.owner_name])
    writer.writerow(["Total Credit Limit (INR)", f"{summary.credit_limit:.2f}"])
    writer.writerow(["Current Outstanding (INR)", f"{summary.current_outstanding:.2f}"])
    writer.writerow(["Available Credit (INR)", f"{summary.available_credit:.2f}"])
    writer.writerow(["Payment Terms", f"{summary.payment_terms_days} days"])
    writer.writerow([])

    # Table columns
    writer.writerow([
        "Transaction Date (IST)",
        "Transaction Type",
        "Reference Number",
        "Debit Amount (INR)",
        "Credit Amount (INR)",
        "Running Outstanding (INR)",
        "Remarks",
    ])

    # Rows in chronological order (or descending)
    for tx in enriched_txs:
        date_ist = tx["created_at"].astimezone(IST).strftime("%d-%b-%Y %I:%M %p")
        tx_type = tx["transaction_type"]
        ref_no = tx["reference_number"] or (str(tx["reference_id"]) if tx["reference_id"] else "")
        amount = tx["amount"]

        debit_str = ""
        credit_str = ""
        if tx_type == "ORDER_DEBIT":
            debit_str = f"{amount:.2f}"
        elif tx_type in ("PAYMENT", "CREDIT_NOTE"):
            credit_str = f"{amount:.2f}"
        else:
            debit_str = f"{amount:.2f}"

        writer.writerow([
            date_ist,
            tx_type,
            ref_no,
            debit_str,
            credit_str,
            f"{tx['running_balance']:.2f}",
            tx["note"] or "",
        ])

    csv_content = output.getvalue()
    filename = f"statement_{retailer.retailer_code}_{datetime.now(IST).strftime('%Y%m%d')}.csv"

    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
