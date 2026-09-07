"""phase3 donor schema updates

Revision ID: 0004_phase3_donor_schema
Revises: 0003_phase2_hospital_schema
Create Date: 2026-08-25 11:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0004_phase3_donor_schema'
down_revision: Union[str, None] = '0003_phase2_hospital_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add check constraint for standardized donor status values
    op.create_check_constraint(
        'ck_donors_status',
        'donors',
        "status IN ('ACTIVE', 'COMPLETED', 'WITHDRAWN', 'EXPIRED', 'Active', 'Completed', 'Withdrawn', 'Expired')"
    )


def downgrade() -> None:
    op.drop_constraint('ck_donors_status', 'donors', type_='check')
