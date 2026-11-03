import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Scheme(Base):
    __tablename__ = "schemes"

    __table_args__ = (
        CheckConstraint(
            "scheme_type IN ('BUY_X_GET_Y', 'SLAB_DISCOUNT')",
            name="ck_scheme_type",
        ),
        CheckConstraint(
            "valid_to > valid_from",
            name="ck_scheme_validity",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    code: Mapped[str] = mapped_column(
        String(40),
        unique=True,
        nullable=False,
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    scheme_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    valid_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    valid_to: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    applies_to_all_retailers: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    
class SchemeRule(Base):
    __tablename__ = "scheme_rules"

    __table_args__ = (
        UniqueConstraint(
            "scheme_id",
            "product_id",
            "tier_number",
            name="uq_scheme_product_tier",
        ),
        CheckConstraint(
            "quantity_unit IN ('CASE', 'PIECE')",
            name="ck_scheme_quantity_unit",
        ),
        CheckConstraint(
            "tier_number >= 1",
            name="ck_scheme_tier_number",
        ),
        CheckConstraint(
            "buy_quantity IS NULL OR buy_quantity > 0",
            name="ck_scheme_buy_quantity",
        ),
        CheckConstraint(
            "reward_quantity IS NULL OR reward_quantity > 0",
            name="ck_scheme_reward_quantity",
        ),
        CheckConstraint(
            "min_quantity IS NULL OR min_quantity > 0",
            name="ck_scheme_min_quantity",
        ),
        CheckConstraint(
            "discount_value IS NULL OR discount_value > 0",
            name="ck_scheme_discount_value",
        ),
        CheckConstraint(
            "discount_type IS NULL OR discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT')",
            name="ck_scheme_discount_type",
        ),
        CheckConstraint(
            "discount_type != 'PERCENTAGE' OR discount_value <= 100",
            name="ck_scheme_percentage_limit",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    scheme_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schemes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # For BUY_X_GET_Y schemes
    reward_product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=True,
    )

    tier_number: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )

    quantity_unit: Mapped[str] = mapped_column(
        String(10),
        default="CASE",
        nullable=False,
    )

    buy_quantity: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 3),
        nullable=True,
    )

    reward_quantity: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 3),
        nullable=True,
    )

    # For SLAB_DISCOUNT schemes
    min_quantity: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 3),
        nullable=True,
    )

    discount_type: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    discount_value: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    
class SchemeRetailer(Base):
    __tablename__ = "scheme_retailers"

    __table_args__ = (
        UniqueConstraint(
            "scheme_id",
            "retailer_id",
            name="uq_scheme_retailer",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    scheme_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schemes.id", ondelete="CASCADE"),
        nullable=False,
    )

    retailer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("retailers.id", ondelete="CASCADE"),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )