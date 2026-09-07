"""add donor registration fields

Revision ID: 0013_donor_reg_fields
Revises: 0012
Create Date: 2026-08-28

"""
from alembic import op
import sqlalchemy as sa
from app.models.base import JSONType

revision = '0013_donor_reg_fields'
down_revision = '0012'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    columns = [c['name'] for c in insp.get_columns('donors')]
    
    if 'date_of_birth' not in columns:
        op.add_column('donors', sa.Column('date_of_birth', sa.Date(), nullable=True))
    if 'gender' not in columns:
        op.add_column('donors', sa.Column('gender', sa.String(length=20), server_default='Not specified', nullable=False))
    if 'contact_number' not in columns:
        op.add_column('donors', sa.Column('contact_number', sa.String(length=50), nullable=True))
    if 'residential_address' not in columns:
        op.add_column('donors', sa.Column('residential_address', sa.Text(), nullable=True))
    if 'donation_preferences' not in columns:
        op.add_column('donors', sa.Column('donation_preferences', JSONType, server_default='{}', nullable=False))
    if 'declaration_acknowledged' not in columns:
        op.add_column('donors', sa.Column('declaration_acknowledged', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    if 'registration_date' not in columns:
        op.add_column('donors', sa.Column('registration_date', sa.Date(), server_default=sa.func.current_date(), nullable=False))
        
    op.alter_column('donors', 'blood_group', existing_type=sa.String(length=10), type_=sa.String(length=50), existing_nullable=False, server_default='Unknown')

def downgrade() -> None:
    op.alter_column('donors', 'blood_group', existing_type=sa.String(length=50), type_=sa.String(length=10), existing_nullable=False)
    op.drop_column('donors', 'registration_date')
    op.drop_column('donors', 'declaration_acknowledged')
    op.drop_column('donors', 'donation_preferences')
    op.drop_column('donors', 'residential_address')
    op.drop_column('donors', 'contact_number')
    op.drop_column('donors', 'gender')
    op.drop_column('donors', 'date_of_birth')

