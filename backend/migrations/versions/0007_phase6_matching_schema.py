"""phase6 matching schema updates

Revision ID: 0007_phase6_matching_schema
Revises: 0006_phase5_recipient_schema
Create Date: 2026-08-25 12:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0007_phase6_matching_schema'
down_revision: Union[str, None] = '0006_phase5_recipient_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('matches', sa.Column('updated_at', sa.DateTime(timezone=False), server_default=sa.text('now()'), nullable=False))

    op.create_check_constraint(
        'ck_matches_status',
        'matches',
        "status IN ('PROPOSED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'PENDING', 'SELECTED', 'Proposed', 'Accepted', 'Rejected', 'Expired', 'Cancelled', 'Pending', 'Selected')"
    )


def downgrade() -> None:
    op.drop_constraint('ck_matches_status', 'matches', type_='check')
    op.drop_column('matches', 'updated_at')
