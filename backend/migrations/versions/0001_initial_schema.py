"""initial schema

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-08-24 17:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable UUID extension
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # 1. hospitals
    op.create_table(
        'hospitals',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('location', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index('idx_hospitals_created_at', 'hospitals', ['created_at'], unique=False)

    # 2. permissions
    op.create_table(
        'permissions',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index('idx_permissions_name', 'permissions', ['name'], unique=False)

    # 3. roles
    op.create_table(
        'roles',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index('idx_roles_name', 'roles', ['name'], unique=False)

    # 4. role_permissions (Association)
    op.create_table(
        'role_permissions',
        sa.Column('role_id', sa.UUID(), nullable=False),
        sa.Column('permission_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('role_id', 'permission_id')
    )

    # 5. users
    op.create_table(
        'users',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('hospital_id', sa.UUID(), nullable=True),
        sa.Column('username', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=150), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='Active', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('username')
    )
    op.create_index('idx_users_created_at', 'users', ['created_at'], unique=False)
    op.create_index('idx_users_email', 'users', ['email'], unique=False)
    op.create_index('idx_users_hospital_id', 'users', ['hospital_id'], unique=False)

    # 6. user_roles (Association)
    op.create_table(
        'user_roles',
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('role_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id', 'role_id')
    )

    # 7. donors
    op.create_table(
        'donors',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('hospital_id', sa.UUID(), nullable=False),
        sa.Column('donor_code', sa.String(length=50), nullable=False),
        sa.Column('age', sa.Integer(), nullable=False),
        sa.Column('blood_group', sa.String(length=10), nullable=False),
        sa.Column('hla_information', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('medical_details', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('status', sa.String(length=20), server_default='ACTIVE', nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('updated_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('donor_code')
    )
    op.create_index('idx_donors_created_at', 'donors', ['created_at'], unique=False)
    op.create_index('idx_donors_donor_code', 'donors', ['donor_code'], unique=False)
    op.create_index('idx_donors_hospital_id', 'donors', ['hospital_id'], unique=False)

    # 8. organs
    op.create_table(
        'organs',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('donor_id', sa.UUID(), nullable=False),
        sa.Column('organ_code', sa.String(length=50), nullable=False),
        sa.Column('organ_type', sa.String(length=20), nullable=False),
        sa.Column('blood_group', sa.String(length=10), nullable=False),
        sa.Column('medical_details', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('status', sa.String(length=20), server_default='AVAILABLE', nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('updated_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['donor_id'], ['donors.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organ_code')
    )
    op.create_index('idx_organs_created_at', 'organs', ['created_at'], unique=False)
    op.create_index('idx_organs_donor_id', 'organs', ['donor_id'], unique=False)
    op.create_index('idx_organs_organ_code', 'organs', ['organ_code'], unique=False)

    # 9. recipients
    op.create_table(
        'recipients',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('hospital_id', sa.UUID(), nullable=False),
        sa.Column('recipient_code', sa.String(length=50), nullable=False),
        sa.Column('age', sa.Integer(), nullable=False),
        sa.Column('blood_group', sa.String(length=10), nullable=False),
        sa.Column('required_organ', sa.String(length=20), nullable=False),
        sa.Column('medical_details', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('hla_information', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('priority', sa.String(length=20), server_default='MEDIUM', nullable=False),
        sa.Column('urgency', sa.String(length=20), server_default='MODERATE', nullable=False),
        sa.Column('status', sa.String(length=20), server_default='ACTIVE', nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('updated_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('recipient_code')
    )
    op.create_index('idx_recipients_created_at', 'recipients', ['created_at'], unique=False)
    op.create_index('idx_recipients_hospital_id', 'recipients', ['hospital_id'], unique=False)
    op.create_index('idx_recipients_recipient_code', 'recipients', ['recipient_code'], unique=False)

    # 10. matches
    op.create_table(
        'matches',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('organ_id', sa.UUID(), nullable=False),
        sa.Column('recipient_id', sa.UUID(), nullable=False),
        sa.Column('compatibility_score', sa.Float(), nullable=False),
        sa.Column('scoring_breakdown', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('rank', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='PENDING', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['organ_id'], ['organs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recipient_id'], ['recipients.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_matches_created_at', 'matches', ['created_at'], unique=False)
    op.create_index('idx_matches_organ_id', 'matches', ['organ_id'], unique=False)
    op.create_index('idx_matches_recipient_id', 'matches', ['recipient_id'], unique=False)

    # 11. allocations
    op.create_table(
        'allocations',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('match_id', sa.UUID(), nullable=False),
        sa.Column('organ_id', sa.UUID(), nullable=False),
        sa.Column('recipient_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.String(length=30), server_default='PENDING', nullable=False),
        sa.Column('approved_by', sa.UUID(), nullable=True),
        sa.Column('rejection_reason', sa.String(length=255), nullable=True),
        sa.Column('fabric_tx_id', sa.String(length=100), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('updated_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['match_id'], ['matches.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['organ_id'], ['organs.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['recipient_id'], ['recipients.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_allocations_created_at', 'allocations', ['created_at'], unique=False)
    op.create_index('idx_allocations_fabric_tx_id', 'allocations', ['fabric_tx_id'], unique=False)
    op.create_index('idx_allocations_match_id', 'allocations', ['match_id'], unique=False)

    # 12. audit_logs
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('username', sa.String(length=100), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('organization', sa.String(length=100), nullable=False),
        sa.Column('operation', sa.String(length=50), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('entity_id', sa.UUID(), nullable=True),
        sa.Column('old_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('new_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('result', sa.String(length=20), nullable=False),
        sa.Column('reason', sa.String(length=255), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=False),
        sa.Column('user_agent', sa.String(length=255), nullable=False),
        sa.Column('fabric_tx_id', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_audit_logs_created_at', 'audit_logs', ['created_at'], unique=False)
    op.create_index('idx_audit_logs_fabric_tx_id', 'audit_logs', ['fabric_tx_id'], unique=False)
    op.create_index('idx_audit_logs_user_id', 'audit_logs', ['user_id'], unique=False)

    # 13. record_versions
    op.create_table(
        'record_versions',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('entity_id', sa.UUID(), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('record_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('record_hash', sa.String(length=64), nullable=False),
        sa.Column('changed_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_record_versions_created_at', 'record_versions', ['created_at'], unique=False)
    op.create_index('idx_record_versions_entity_id', 'record_versions', ['entity_id'], unique=False)
    op.create_index('idx_record_versions_entity_type', 'record_versions', ['entity_type'], unique=False)

    # 14. security_events
    op.create_table(
        'security_events',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('event_code', sa.String(length=50), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('record_id', sa.UUID(), nullable=True),
        sa.Column('operation', sa.String(length=50), nullable=False),
        sa.Column('tampering_type', sa.String(length=50), nullable=False),
        sa.Column('source', sa.String(length=20), nullable=False),
        sa.Column('reason', sa.String(length=255), nullable=False),
        sa.Column('old_hash', sa.String(length=64), nullable=True),
        sa.Column('new_hash', sa.String(length=64), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='DETECTED', nullable=False),
        sa.Column('fabric_tx_id', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('resolved_by', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('event_code')
    )
    op.create_index('idx_security_events_created_at', 'security_events', ['created_at'], unique=False)
    op.create_index('idx_security_events_event_code', 'security_events', ['event_code'], unique=False)
    op.create_index('idx_security_events_fabric_tx_id', 'security_events', ['fabric_tx_id'], unique=False)
    op.create_index('idx_security_events_record_id', 'security_events', ['record_id'], unique=False)
    op.create_index('idx_security_events_user_id', 'security_events', ['user_id'], unique=False)

    # 15. blockchain_transactions
    op.create_table(
        'blockchain_transactions',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('fabric_tx_id', sa.String(length=100), nullable=False),
        sa.Column('record_id', sa.UUID(), nullable=False),
        sa.Column('record_type', sa.String(length=50), nullable=False),
        sa.Column('operation', sa.String(length=50), nullable=False),
        sa.Column('payload_hash', sa.String(length=64), nullable=False),
        sa.Column('channel', sa.String(length=50), nullable=False),
        sa.Column('chaincode', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='PENDING', nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('fabric_tx_id')
    )
    op.create_index('idx_blockchain_tx_created_at', 'blockchain_transactions', ['created_at'], unique=False)
    op.create_index('idx_blockchain_tx_fabric_tx_id', 'blockchain_transactions', ['fabric_tx_id'], unique=False)
    op.create_index('idx_blockchain_tx_record_id', 'blockchain_transactions', ['record_id'], unique=False)


def downgrade() -> None:
    op.drop_table('blockchain_transactions')
    op.drop_table('security_events')
    op.drop_table('record_versions')
    op.drop_table('audit_logs')
    op.drop_table('allocations')
    op.drop_table('matches')
    op.drop_table('recipients')
    op.drop_table('organs')
    op.drop_table('donors')
    op.drop_table('user_roles')
    op.drop_table('users')
    op.drop_table('role_permissions')
    op.drop_table('roles')
    op.drop_table('permissions')
    op.drop_table('hospitals')
    op.execute('DROP EXTENSION IF EXISTS "uuid-ossp"')
