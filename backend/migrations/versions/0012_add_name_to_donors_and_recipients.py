"""add name to donors and recipients

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-25

"""
from alembic import op
import sqlalchemy as sa

revision = '0012'
down_revision = '0011_phase10_sys_settings'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    donor_cols = [c['name'] for c in inspector.get_columns('donors')]
    recip_cols = [c['name'] for c in inspector.get_columns('recipients')]

    if 'name' not in donor_cols:
        op.add_column('donors', sa.Column('name', sa.String(length=255), nullable=True))
    if 'name' not in recip_cols:
        op.add_column('recipients', sa.Column('name', sa.String(length=255), nullable=True))

def downgrade() -> None:
    op.drop_column('donors', 'name')
    op.drop_column('recipients', 'name')

