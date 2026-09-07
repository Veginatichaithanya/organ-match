import pytest
import uuid
from httpx import AsyncClient
from conftest import TEST_AUTH_SECRET

@pytest.mark.asyncio
async def test_rbac_permission_denial(client: AsyncClient, seed_data):
    """
    Verifies that a user lacking required permission is blocked.
    (e.g., Hospital Coordinator attempting to view audit logs, which requires VIEW_AUDIT).
    """
    # 1. Login as coordinator
    login_resp = await client.post(
        "/api/auth/login",
        json={"username_or_email": "hospital@organmatch.in", "password": TEST_AUTH_SECRET}
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    
    # 2. Query /api/admin/users/ endpoint (requires ADMIN / MANAGE_USERS permission)
    headers = {"Authorization": f"Bearer {token}"}
    admin_resp = await client.get("/api/admin/users/", headers=headers)
    
    # Should yield 403 Forbidden with custom RBAC error codes
    assert admin_resp.status_code == 403
    data = admin_resp.json()
    assert data["error"]["code"] in ["ABAC_VIOLATION", "PERMISSION_DENIED"]


@pytest.mark.asyncio
async def test_abac_hospital_scope_isolation(client: AsyncClient, seed_data):
    """
    Asserts a coordinator can register records ONLY under their own hospital.
    (e.g., Coordinator from Hospital A trying to register donor under Hospital B).
    """
    # 1. Login as Hospital A coordinator
    login_resp = await client.post(
        "/api/auth/login",
        json={"username_or_email": "hospital@organmatch.in", "password": TEST_AUTH_SECRET}
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Hospital B ID from seed
    hospital_b_id = str(seed_data["hospitals"]["B"].id)

    # 2. Attempt to create a donor under Hospital B
    payload = {
        "donor_code": "D_TEST_999",
        "age": 45,
        "blood_group": "O+",
        "hla_information": {"A": "02", "B": "07"},
        "medical_details": {"weight_kg": 75},
        "hospital_id": hospital_b_id
    }
    
    resp = await client.post("/api/donors/", json=payload, headers=headers)
    
    # Should yield 403 Forbidden with ABAC violation code
    assert resp.status_code == 403
    data = resp.json()
    assert data["error"]["code"] == "ABAC_VIOLATION"
    assert "different hospital" in data["error"]["message"].lower() or "hospital" in data["error"]["message"].lower()
