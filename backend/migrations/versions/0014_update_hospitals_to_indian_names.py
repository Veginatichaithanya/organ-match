"""update hospitals to indian names

Revision ID: 0014_update_hospitals_to_indian_names
Revises: 0013_donor_reg_fields
Create Date: 2026-09-30

"""
from alembic import op
import sqlalchemy as sa

revision = '0014_update_hospitals_to_indian_names'
down_revision = '0013_donor_reg_fields'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()

    # 1. Update Hospital A to AIIMS New Delhi
    conn.execute(sa.text("""
        UPDATE hospitals
        SET name = 'AIIMS New Delhi (All India Institute of Medical Sciences)',
            code = 'AIIMS-DEL',
            location = 'New Delhi, Delhi, India',
            updated_at = NOW()
        WHERE id = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0'
           OR name ILIKE '%Hospital A%'
           OR name ILIKE '%General Care%';
    """))

    # 2. Update Hospital B to Apollo Hospitals
    conn.execute(sa.text("""
        UPDATE hospitals
        SET name = 'Apollo Hospitals (Transplant Centre)',
            code = 'APOLLO-CHE',
            location = 'Chennai, Tamil Nadu, India',
            updated_at = NOW()
        WHERE id = 'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0'
           OR name ILIKE '%Hospital B%'
           OR name ILIKE '%Metropolitan%';
    """))

    # 3. Add Fortis Memorial Research Institute if not exists
    conn.execute(sa.text("""
        INSERT INTO hospitals (id, name, code, location, status, created_at, updated_at)
        VALUES (
            'c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0',
            'Fortis Memorial Research Institute',
            'FORTIS-GGN',
            'Gurugram, Haryana, India',
            'Active',
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            code = EXCLUDED.code,
            location = EXCLUDED.location,
            updated_at = NOW();
    """))

    # 4. Add KIMS Hospitals if not exists
    conn.execute(sa.text("""
        INSERT INTO hospitals (id, name, code, location, status, created_at, updated_at)
        VALUES (
            'd0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d0d0',
            'KIMS Hospitals (Krishna Institute of Medical Sciences)',
            'KIMS-HYD',
            'Hyderabad, Telangana, India',
            'Active',
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            code = EXCLUDED.code,
            location = EXCLUDED.location,
            updated_at = NOW();
    """))

def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("""
        UPDATE hospitals
        SET name = 'Hospital A (General Care)',
            code = 'HOSP-A',
            location = 'New Delhi, India',
            updated_at = NOW()
        WHERE id = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0';
    """))
    conn.execute(sa.text("""
        UPDATE hospitals
        SET name = 'Hospital B (Metropolitan)',
            code = 'HOSP-B',
            location = 'Boston, USA',
            updated_at = NOW()
        WHERE id = 'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0';
    """))
