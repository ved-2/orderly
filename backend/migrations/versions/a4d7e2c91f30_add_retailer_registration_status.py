"""add retailer registration status

Revision ID: a4d7e2c91f30
Revises: 65dc2d2e1f66
Create Date: 2026-11-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a4d7e2c91f30"
down_revision: Union[str, Sequence[str], None] = "65dc2d2e1f66"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "retailers",
        sa.Column(
            "registration_status",
            sa.String(length=30),
            server_default="PENDING_REVIEW",
            nullable=False,
        ),
    )
    op.alter_column(
        "retailers",
        "registration_status",
        server_default=None,
    )
    op.create_check_constraint(
        "ck_retailer_registration_status",
        "retailers",
        "registration_status IN "
        "('PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'SUSPENDED')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_retailer_registration_status",
        "retailers",
        type_="check",
    )
    op.drop_column("retailers", "registration_status")
