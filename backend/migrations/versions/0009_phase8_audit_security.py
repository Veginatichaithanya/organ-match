"""phase8 audit security schema updates

Revision ID: 0009_phase8_audit_security
Revises: 0008_phase7_allocation_schema
Create Date: 2026-08-25 12:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0009_phase8_audit_security'
down_revision: Union[str, None] = '0008_phase7_allocation_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Composite indexes for record versions and audit logs
    op.create_index('ix_audit_logs_entity_lookup', 'audit_logs', ['entity_type', 'entity_id'], unique=False)
    op.create_index('ix_record_versions_entity_lookup', 'record_versions', ['entity_type', 'entity_id', 'version_number'], unique=False)

    # Check constraint for security_events status
    op.create_check_constraint(
        'ck_security_events_status',
        'security_events',
        "status IN ('DETECTED', 'BLOCKED', 'INVESTIGATING', 'RESOLVED', 'LOGGED', 'UNDER_REVIEW', 'DISMISSED', 'Detected', 'Blocked', 'Investigating', 'Resolved', 'Logged', 'Under_Review', 'Dismissed')"
    )


def downgrade() -> None:
    op.drop_constraint('ck_security_events_status', 'security_events', type_='check')
    op.drop_index('ix_record_versions_entity_lookup', table_name='record_versions')
    op.drop_index('ix_audit_logs_entity_lookup', table_name='audit_logs')
