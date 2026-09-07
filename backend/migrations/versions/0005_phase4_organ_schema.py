"""phase4 organ schema updates

Revision ID: 0005_phase4_organ_schema
Revises: 0004_phase3_donor_schema
Create Date: 2026-08-25 11:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0005_phase4_organ_schema'
down_revision: Union[str, None] = '0004_phase3_donor_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add ischemic fields and updated_at
    op.add_column('organs', sa.Column('ischemic_start_time', sa.DateTime(timezone=False), nullable=True))
    op.add_column('organs', sa.Column('max_ischemic_hours', sa.Integer(), nullable=True))
    op.add_column('organs', sa.Column('updated_at', sa.DateTime(timezone=False), server_default=sa.text('now()'), nullable=False))

    # Add check constraint for organ status
    op.create_check_constraint(
        'ck_organs_status',
        'organs',
        "status IN ('AVAILABLE', 'RESERVED', 'ALLOCATED', 'TRANSPLANTED', 'EXPIRED', 'DISCARDED', 'Available', 'Reserved', 'Allocated', 'Transplanted', 'Expired', 'Discarded')"
    )


def downgrade() -> None:
    op.drop_constraint('ck_organs_status', 'organs', type_='check')
    op.drop_column('organs', 'updated_at')
    op.drop_column('organs', 'max_ischemic_hours')
    op.drop_column('organs', 'ischemic_start_time')
