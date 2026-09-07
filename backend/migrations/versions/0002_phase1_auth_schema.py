"""phase1 auth schema updates

Revision ID: 0002_phase1_auth_schema
Revises: 0001_initial_schema
Create Date: 2026-08-25 11:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0002_phase1_auth_schema'
down_revision: Union[str, None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users missing columns
    op.add_column('users', sa.Column('full_name', sa.String(length=150), nullable=True))
    op.add_column('users', sa.Column('must_change_password', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('users', sa.Column('failed_login_attempts', sa.Integer(), server_default=sa.text('0'), nullable=False))
    op.add_column('users', sa.Column('locked_until', sa.DateTime(timezone=False), nullable=True))
    op.add_column('users', sa.Column('last_login_at', sa.DateTime(timezone=False), nullable=True))
    op.add_column('users', sa.Column('created_by', sa.UUID(), nullable=True))
    op.add_column('users', sa.Column('updated_by', sa.UUID(), nullable=True))
    op.add_column('users', sa.Column('updated_at', sa.DateTime(timezone=False), server_default=sa.text('now()'), nullable=False))

    op.create_index('ix_users_locked_until', 'users', ['locked_until'], unique=False)

    # 2. permissions missing created_at
    op.add_column('permissions', sa.Column('created_at', sa.DateTime(timezone=False), server_default=sa.text('now()'), nullable=False))

    # 3. roles missing created_at
    op.add_column('roles', sa.Column('created_at', sa.DateTime(timezone=False), server_default=sa.text('now()'), nullable=False))

    # 4. role_permissions missing assigned_at
    op.add_column('role_permissions', sa.Column('assigned_at', sa.DateTime(timezone=False), server_default=sa.text('now()'), nullable=False))

    # 5. user_roles missing assigned_by and assigned_at
    op.add_column('user_roles', sa.Column('assigned_by', sa.UUID(), nullable=True))
    op.add_column('user_roles', sa.Column('assigned_at', sa.DateTime(timezone=False), server_default=sa.text('now()'), nullable=False))
    op.create_foreign_key('user_roles_assigned_by_fkey', 'user_roles', 'users', ['assigned_by'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('user_roles_assigned_by_fkey', 'user_roles', type_='foreignkey')
    op.drop_column('user_roles', 'assigned_at')
    op.drop_column('user_roles', 'assigned_by')
    op.drop_column('role_permissions', 'assigned_at')
    op.drop_column('roles', 'created_at')
    op.drop_column('permissions', 'created_at')
    op.drop_index('ix_users_locked_until', table_name='users')
    op.drop_column('users', 'updated_at')
    op.drop_column('users', 'updated_by')
    op.drop_column('users', 'created_by')
    op.drop_column('users', 'last_login_at')
    op.drop_column('users', 'locked_until')
    op.drop_column('users', 'failed_login_attempts')
    op.drop_column('users', 'must_change_password')
    op.drop_column('users', 'full_name')
