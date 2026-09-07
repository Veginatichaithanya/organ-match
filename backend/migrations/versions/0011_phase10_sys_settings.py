"""phase10 sys settings schema updates

Revision ID: 0011_phase10_sys_settings
Revises: 0010_phase9_blockchain_tx
Create Date: 2026-08-25 13:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0011_phase10_sys_settings'
down_revision: Union[str, None] = '0010_phase9_blockchain_tx'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'system_settings',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('setting_key', sa.String(length=100), nullable=False),
        sa.Column('setting_value', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('is_encrypted', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('updated_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=False), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('setting_key')
    )
    op.create_index('ix_system_settings_setting_key', 'system_settings', ['setting_key'], unique=True)
    op.create_index('ix_system_settings_created_at', 'system_settings', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_system_settings_created_at', table_name='system_settings')
    op.drop_index('ix_system_settings_setting_key', table_name='system_settings')
    op.drop_table('system_settings')
