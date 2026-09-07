"""phase2 hospital schema updates

Revision ID: 0003_phase2_hospital_schema
Revises: 0002_phase1_auth_schema
Create Date: 2026-08-25 11:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0003_phase2_hospital_schema'
down_revision: Union[str, None] = '0002_phase1_auth_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('hospitals', sa.Column('code', sa.String(length=50), nullable=True))
    op.add_column('hospitals', sa.Column('contact_email', sa.String(length=255), nullable=True))
    op.add_column('hospitals', sa.Column('contact_phone', sa.String(length=50), nullable=True))
    op.add_column('hospitals', sa.Column('address', sa.String(length=500), nullable=True))
    op.add_column('hospitals', sa.Column('status', sa.String(length=20), server_default='Active', nullable=False))
    op.add_column('hospitals', sa.Column('updated_at', sa.DateTime(timezone=False), server_default=sa.text('now()'), nullable=False))

    op.create_index('ix_hospitals_code', 'hospitals', ['code'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_hospitals_code', table_name='hospitals')
    op.drop_column('hospitals', 'updated_at')
    op.drop_column('hospitals', 'status')
    op.drop_column('hospitals', 'address')
    op.drop_column('hospitals', 'contact_phone')
    op.drop_column('hospitals', 'contact_email')
    op.drop_column('hospitals', 'code')
