import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CreditAccount(Base):
    __tablename__ = "credit_accounts"

    __table_args__ = (
        UniqueConstraint(
            "retailer_id",
            name="uq_credit_account_retailer",
        ),
        CheckConstraint(
            "credit_limit >= 0",
            name="ck_credit_limit_nonnegative",
        ),
        CheckConstraint(
            "current_outstanding >= 0",
            name="ck_credit_outstanding_nonnegative",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    retailer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("retailers.id", ondelete="RESTRICT"),
        nullable=False,
    )

    credit_limit: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=0,
    )

    current_outstanding: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=0,
    )

    payment_terms_days: Mapped[int] = mapped_column(
        default=7,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    
class CreditTransaction(Base):
    __tablename__ = "credit_transactions"

    __table_args__ = (
        CheckConstraint(
            "amount > 0",
            name="ck_credit_transaction_amount_positive",
        ),
        CheckConstraint(
            "transaction_type IN ('ORDER_DEBIT', 'PAYMENT', 'CREDIT_NOTE', 'ADJUSTMENT')",
            name="ck_credit_transaction_type",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    credit_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("credit_accounts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    transaction_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )

    reference_type: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    reference_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    note: Mapped[str | None] = mapped_column(
        String(300),
        nullable=True,
    )

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )