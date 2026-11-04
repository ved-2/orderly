"""add retailer settings table

Revision ID: f1a8c9b2d3e4
Revises: e7b91d2a45f0
Create Date: 2026-11-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "f1a8c9b2d3e4"
down_revision: Union[str, Sequence[str], None] = "e7b91d2a45f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "retailer_settings",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "retailer_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("retailers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("gstin", sa.String(length=20), nullable=True),
        sa.Column("language", sa.String(length=10), server_default="en", nullable=False),
        sa.Column(
            "order_notifications",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "order_confirmation_notifications",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "delivery_notifications",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "account_notifications",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "promotional_notifications",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("retailer_id", name="uq_retailer_settings_retailer_id"),
    )
    op.create_index(
        "ix_retailer_settings_retailer_id",
        "retailer_settings",
        ["retailer_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_retailer_settings_retailer_id", table_name="retailer_settings")
    op.drop_table("retailer_settings")
