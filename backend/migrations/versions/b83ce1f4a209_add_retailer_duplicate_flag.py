"""add retailer duplicate flag

Revision ID: b83ce1f4a209
Revises: 939ac6a0f52e
Create Date: 2026-11-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b83ce1f4a209"
down_revision: Union[str, Sequence[str], None] = "939ac6a0f52e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "retailers",
        sa.Column(
            "duplicate_flag",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )
    op.alter_column(
        "retailers",
        "duplicate_flag",
        server_default=None,
    )
    op.create_index(
        "ix_retailers_registration_status",
        "retailers",
        ["registration_status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_retailers_registration_status",
        table_name="retailers",
    )
    op.drop_column("retailers", "duplicate_flag")
