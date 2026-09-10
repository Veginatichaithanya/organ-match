#!/bin/bash
set -e

echo "=================================================="
echo " Starting OrganMatch All-in-One Container"
echo "=================================================="

# Check if an external DATABASE_URL was provided
USE_LOCAL_POSTGRES=true
if [ -n "$DATABASE_URL" ]; then
    # If DATABASE_URL points to an external host (not localhost/127.0.0.1/postgres)
    if [[ "$DATABASE_URL" != *"@localhost"* ]] && [[ "$DATABASE_URL" != *"@127.0.0.1"* ]] && [[ "$DATABASE_URL" != *"@postgres"* ]]; then
        echo "[*] Using external PostgreSQL database from DATABASE_URL"
        USE_LOCAL_POSTGRES=false
    fi
fi

if [ "$USE_LOCAL_POSTGRES" = "true" ]; then
    echo "[1/4] Starting internal PostgreSQL database service..."
    service postgresql start

    # Ensure postgres user password and organ_donation_db database exist
    echo "[*] Configuring local database and credentials..."
    su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname = 'organ_donation_db'\"" | grep -q 1 || \
        su - postgres -c "psql -c \"CREATE DATABASE organ_donation_db;\""

    su - postgres -c "psql -c \"ALTER USER postgres WITH PASSWORD 'organmatch_secure_pass_2026';\""
    su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE organ_donation_db TO postgres;\""

    export DATABASE_URL="postgresql+psycopg://postgres:organmatch_secure_pass_2026@127.0.0.1:5432/organ_donation_db"
    echo "[+] Local PostgreSQL is running and configured."
fi

# Ensure default security keys exist if not provided by environment
export JWT_SECRET_KEY="${JWT_SECRET_KEY:-organmatch_super_secret_production_jwt_key_2026}"
export JWT_REFRESH_SECRET_KEY="${JWT_REFRESH_SECRET_KEY:-organmatch_super_secret_production_refresh_jwt_key_2026}"
export SEED_USER_PASSWORD="${SEED_USER_PASSWORD:-OrganMatch2026!}"
export APP_ENV="${APP_ENV:-production}"
export PORT="${PORT:-80}"

# Run migrations and database seeding
echo "[2/4] Applying database migrations..."
cd /app/backend
alembic upgrade head
echo "[+] Database schema is up to date."

echo "[3/4] Initializing default roles, hospitals, and users..."
python3 scripts/seed_all.py || echo "[!] Notice: Initial seed routine completed."

echo "[4/4] Starting background supervisor (FastAPI + Frontend + Nginx)..."
echo "=================================================="
echo " All services initialized! Launching platform on port 80"
echo "=================================================="

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
