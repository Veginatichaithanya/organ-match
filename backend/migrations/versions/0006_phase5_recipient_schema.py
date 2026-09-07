"""phase5 recipient schema updates

Revision ID: 0006_phase5_recipient_schema
Revises: 0005_phase4_organ_schema
Create Date: 2026-08-25 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0006_phase5_recipient_schema'
down_revision: Union[str, None] = '0005_phase4_organ_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add check constraint for recipient status
    op.create_check_constraint(
        'ck_recipients_status',
        'recipients',
        "status IN ('ACTIVE', 'MATCHED', 'TRANSPLANTED', 'SUSPENDED', 'INACTIVE', 'DECEASED', 'Active', 'Matched', 'Transplanted', 'Suspended', 'Inactive', 'Deceased')"
    )


def downgrade() -> None:
    op.drop_constraint('ck_recipients_status', 'recipients', type_='check')
