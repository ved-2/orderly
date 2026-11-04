import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RetailerSettings(Base):
    __tablename__ = "retailer_settings"

    __table_args__ = (
        UniqueConstraint("retailer_id", name="uq_retailer_settings_retailer_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    retailer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("retailers.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    gstin: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    language: Mapped[str] = mapped_column(
        String(10),
        default="en",
        nullable=False,
    )

    order_notifications: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    order_confirmation_notifications: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    delivery_notifications: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    account_notifications: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    promotional_notifications: Mapped[bool] = mapped_column(
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
