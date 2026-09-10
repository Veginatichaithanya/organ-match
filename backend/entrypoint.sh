#!/bin/sh
set -e

echo "=================================================="
echo " Starting OrganMatch Backend Service"
echo "=================================================="

# 1. Wait for PostgreSQL database to be reachable
echo "[1/3] Waiting for PostgreSQL database..."
python3 - <<'EOF'
import time
import os
import sys
import socket
from urllib.parse import urlparse

db_url = os.getenv("DATABASE_URL", "")
host = os.getenv("POSTGRES_HOST", "postgres")
port = int(os.getenv("POSTGRES_PORT", "5432"))

if db_url and "@" in db_url:
    try:
        # Extract host and port from URL
        netloc = db_url.split("@")[-1].split("/")[0]
        if ":" in netloc:
            host, p = netloc.split(":")
            port = int(p)
        else:
            host = netloc
    except Exception:
        pass

max_retries = 30
retry_interval = 2

for attempt in range(1, max_retries + 1):
    try:
        with socket.create_connection((host, port), timeout=2):
            print(f"[+] Successfully connected to PostgreSQL at {host}:{port}")
            sys.exit(0)
    except Exception as exc:
        print(f"[-] [{attempt}/{max_retries}] PostgreSQL not ready at {host}:{port} ({exc}), waiting {retry_interval}s...")
        time.sleep(retry_interval)

print("[!] Error: Could not connect to PostgreSQL within timeout period.")
sys.exit(1)
EOF

# 2. Run database migrations
echo "[2/3] Applying database migrations (Alembic)..."
alembic upgrade head
echo "[+] Migrations up-to-date."

# 3. Seed initial database data if needed
echo "[3/3] Checking initial database seed..."
AUTO_SEED="${AUTO_SEED:-true}"
if [ "$AUTO_SEED" = "true" ]; then
    python3 scripts/seed_all.py || echo "[!] Notice: Seed script finished with notice (existing records preserved)."
fi

echo "=================================================="
echo " Backend Initialization Complete — Launching Server"
echo "=================================================="

# Start Uvicorn ASGI server
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 "$@"
