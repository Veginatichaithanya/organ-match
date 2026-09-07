"""phase9 blockchain tx schema updates

Revision ID: 0010_phase9_blockchain_tx
Revises: 0009_phase8_audit_security
Create Date: 2026-08-25 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0010_phase9_blockchain_tx'
down_revision: Union[str, None] = '0009_phase8_audit_security'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index('ix_blockchain_tx_entity_lookup', 'blockchain_transactions', ['record_type', 'record_id'], unique=False)

    op.create_check_constraint(
        'ck_blockchain_tx_status',
        'blockchain_transactions',
        "status IN ('PENDING', 'CONFIRMED', 'FAILED', 'Pending', 'Confirmed', 'Failed')"
    )


def downgrade() -> None:
    op.drop_constraint('ck_blockchain_tx_status', 'blockchain_transactions', type_='check')
    op.drop_index('ix_blockchain_tx_entity_lookup', table_name='blockchain_transactions')
