import os
import asyncio
import asyncpg
from app.config import settings

async def main():
    db_url = os.getenv("DATABASE_URL") or settings.DATABASE_URL
    # Convert SQLAlchemy driver prefix to standard asyncpg URL if necessary
    asyncpg_url = db_url.replace("postgresql+psycopg://", "postgresql://")
    conn = await asyncpg.connect(asyncpg_url)
    try:
        tables = await conn.fetch("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;")
        print("DATABASE_TABLES:", [r['table_name'] for r in tables])
        
        # Check audit_logs and record_versions
        has_audit = any(r['table_name'] == 'audit_logs' for r in tables)
        has_versions = any(r['table_name'] == 'record_versions' for r in tables)
        print("HAS_AUDIT_LOGS:", has_audit)
        print("HAS_RECORD_VERSIONS:", has_versions)

        # Count records in core tables
        for tbl in ['users', 'roles', 'permissions', 'hospitals', 'donors', 'recipients', 'organs', 'matches', 'allocations', 'medical_assessments', 'security_events', 'blockchain_transactions']:
            if any(r['table_name'] == tbl for r in tables):
                cnt = await conn.fetchval(f"SELECT count(*) FROM {tbl};")
                print(f"COUNT {tbl}: {cnt}")
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
