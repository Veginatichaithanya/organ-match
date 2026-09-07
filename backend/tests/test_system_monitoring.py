import pytest
from httpx import AsyncClient
from fastapi import status
from conftest import TEST_AUTH_SECRET

@pytest.mark.asyncio
async def test_admin_system_monitoring_endpoints(
    client: AsyncClient,
    seed_data
):
    # Authenticate as Admin user
    login_res = await client.post("/api/auth/login", json={
        "username_or_email": "admin@organmatch.in",
        "password": TEST_AUTH_SECRET
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Health
    res = await client.get("/api/admin/system/health", headers=headers)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert "overall_status" in data
    assert "services" in data

    # 2. PostgreSQL
    res = await client.get("/api/admin/system/postgresql", headers=headers)
    assert res.status_code == status.HTTP_200_OK
    pg = res.json()
    assert "database_name" in pg
    assert "host" in pg

    # 3. Database Tables
    res = await client.get("/api/admin/system/database", headers=headers)
    assert res.status_code == status.HTTP_200_OK
    tables = res.json()
    assert "tables" in tables

    # 4. Backend API
    res = await client.get("/api/admin/system/backend", headers=headers)
    assert res.status_code == status.HTTP_200_OK

    # 5. Authentication
    res = await client.get("/api/admin/system/authentication", headers=headers)
    assert res.status_code == status.HTTP_200_OK

    # 6. Docker
    res = await client.get("/api/admin/system/docker", headers=headers)
    assert res.status_code == status.HTTP_200_OK

    # 7. Blockchain
    res = await client.get("/api/admin/system/blockchain", headers=headers)
    assert res.status_code == status.HTTP_200_OK

    # 8. API Activity
    res = await client.get("/api/admin/system/api-activity", headers=headers)
    assert res.status_code == status.HTTP_200_OK

    # 9. Errors
    res = await client.get("/api/admin/system/errors", headers=headers)
    assert res.status_code == status.HTTP_200_OK

    # 10. Security
    res = await client.get("/api/admin/system/security", headers=headers)
    assert res.status_code == status.HTTP_200_OK

@pytest.mark.asyncio
async def test_non_admin_system_monitoring_forbidden(
    client: AsyncClient,
    doctor_token_headers: dict
):
    # Non-admin Doctor attempting to access system health MUST be rejected with 403 Forbidden
    res = await client.get("/api/admin/system/health", headers=doctor_token_headers)
    assert res.status_code == status.HTTP_403_FORBIDDEN

    # Non-admin Doctor attempting to access PostgreSQL metrics MUST be rejected with 403 Forbidden
    res = await client.get("/api/admin/system/postgresql", headers=doctor_token_headers)
    assert res.status_code == status.HTTP_403_FORBIDDEN
