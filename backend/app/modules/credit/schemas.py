from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RetailerInfo(BaseModel):
    id: UUID
    shop_name: str
    owner_name: str
    retailer_code: str
    phone: str

    model_config = ConfigDict(from_attributes=True)


class CreditSummaryResponse(BaseModel):
    retailer: RetailerInfo
    credit_limit: Decimal
    current_outstanding: Decimal
    available_credit: Decimal
    utilization_percentage: float
    payment_terms_days: int
    account_status: Literal["HEALTHY", "NEAR_LIMIT", "LIMIT_EXCEEDED", "NOT_ASSIGNED"]
    updated_at: Optional[datetime] = None
    total_debits_amount: Decimal
    total_payments_amount: Decimal
    total_transactions_count: int


class LedgerEntryItem(BaseModel):
    id: UUID
    transaction_type: Literal["ORDER_DEBIT", "PAYMENT", "CREDIT_NOTE", "ADJUSTMENT"]
    amount: Decimal
    reference_type: Optional[str] = None
    reference_id: Optional[UUID] = None
    reference_number: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime
    running_balance: Decimal


class OutstandingInvoiceItem(BaseModel):
    order_id: UUID
    order_number: str
    total_amount: Decimal
    approved_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    days_remaining: Optional[int] = None
    is_overdue: bool = False


class CreditLedgerResponse(BaseModel):
    summary: CreditSummaryResponse
    items: List[LedgerEntryItem]
    outstanding_invoices: List[OutstandingInvoiceItem]
    total_count: int
