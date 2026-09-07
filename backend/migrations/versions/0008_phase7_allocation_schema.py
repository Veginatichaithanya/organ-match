"""phase7 allocation schema updates

Revision ID: 0008_phase7_allocation_schema
Revises: 0007_phase6_matching_schema
Create Date: 2026-08-25 12:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0008_phase7_allocation_schema'
down_revision: Union[str, None] = '0007_phase6_matching_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_check_constraint(
        'ck_allocations_status',
        'allocations',
        "status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED', 'DATABASE_COMMITTED', 'FABRIC_SUBMITTED', 'FABRIC_CONFIRMED', 'FABRIC_FAILED', 'Pending', 'Approved', 'Rejected', 'Completed', 'Cancelled')"
    )


def downgrade() -> None:
    op.drop_constraint('ck_allocations_status', 'allocations', type_='check')
