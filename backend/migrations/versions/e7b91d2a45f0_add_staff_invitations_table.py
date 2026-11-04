"""add staff invitations table

Revision ID: e7b91d2a45f0
Revises: c4f8d1a26b30
Create Date: 2026-11-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e7b91d2a45f0"
down_revision: Union[str, Sequence[str], None] = "c4f8d1a26b30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "staff_invitations",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=30), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "invited_by",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_staff_invitations_email",
        "staff_invitations",
        ["email"],
        unique=False,
    )
    op.create_index(
        "ix_staff_invitations_token_hash",
        "staff_invitations",
        ["token_hash"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_staff_invitations_token_hash", table_name="staff_invitations")
    op.drop_index("ix_staff_invitations_email", table_name="staff_invitations")
    op.drop_table("staff_invitations")
