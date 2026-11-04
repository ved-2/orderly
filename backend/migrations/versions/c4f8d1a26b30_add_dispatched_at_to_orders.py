"""add dispatched_at to orders

Revision ID: c4f8d1a26b30
Revises: 462b87622946
Create Date: 2026-11-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4f8d1a26b30"
down_revision: Union[str, Sequence[str], None] = "462b87622946"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("orders", "dispatched_at")
