import os
import asyncio
import asyncpg
from app.config import settings

async def main():
    import urllib.parse
    import ssl
    db_url = os.getenv("DATABASE_URL") or settings.DATABASE_URL
    # Convert SQLAlchemy driver prefix to standard asyncpg URL if necessary
    asyncpg_url = db_url.replace("postgresql+psycopg://", "postgresql://")
    parsed = urllib.parse.urlparse(asyncpg_url)
    query_params = urllib.parse.parse_qs(parsed.query)
    sslmode = query_params.pop("sslmode", [None])[0] or query_params.pop("ssl", [None])[0]
    connect_kwargs = {}
    if sslmode and sslmode.lower() not in ("disable", "false", "0"):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        connect_kwargs["ssl"] = ctx
    clean_query = urllib.parse.urlencode({k: v[0] if len(v) == 1 else v for k, v in query_params.items()}, doseq=True)
    asyncpg_url = urllib.parse.urlunparse(parsed._replace(query=clean_query))
    conn = await asyncpg.connect(asyncpg_url, **connect_kwargs)
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
