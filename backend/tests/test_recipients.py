import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.future import select
from app.models.recipient import Recipient
from conftest import TEST_AUTH_SECRET

@pytest.mark.asyncio
async def test_recipient_valid_registration(client: AsyncClient, seed_data, db_session):
    """
    TEST 1 — Valid registration
    Expected: 201 Created and recipient created with correct hospital, actor, defaults.
    """
    # 1. Login as Hospital A Coordinator
    login_resp = await client.post(
        "/api/auth/login",
        json={"username_or_email": "hospital@organmatch.in", "password": TEST_AUTH_SECRET}
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    hospital_a_id = str(seed_data["hospitals"]["A"].id)

    # 2. Register recipient
    payload = {
        "name": "Sai Kumar",
        "age": 40,
        "blood_group": "A+",
        "required_organ": "Kidney",
        "priority": "Medium",
        "urgency": "Moderate",
        "medical_details": {
            "condition": "Once the organ is registered and available, it becomes a candidate for the matching engine.",
            "suitability": "High",
            "gender": "Male"
        },
        "hla_information": {"raw": "A2,A3"},
        "hospital_id": hospital_a_id
    }

    resp = await client.post("/api/recipients/", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()

    assert data["name"] == "Sai Kumar"
    assert data["age"] == 40
    assert data["blood_group"] == "A+"
    assert data["required_organ"] == "KIDNEY"
    assert data["priority"] == "MEDIUM"
    assert data["urgency"] == "MODERATE"
    assert data["status"] == "ACTIVE"
    assert data["hospital_id"] == hospital_a_id
    assert data["recipient_code"].startswith("REC-")
    assert "id" in data


@pytest.mark.asyncio
async def test_recipient_missing_required_field(client: AsyncClient, seed_data):
    """
    TEST 2 — Missing required field
    Expected: 422 Unprocessable Entity / validation error.
    """
    login_resp = await client.post(
        "/api/auth/login",
        json={"username_or_email": "hospital@organmatch.in", "password": TEST_AUTH_SECRET}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Missing blood_group and required_organ
    payload = {
        "name": "Incomplete Recipient",
        "age": 30
    }

    resp = await client.post("/api/recipients/", json=payload, headers=headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_recipient_invalid_blood_group(client: AsyncClient, seed_data):
    """
    TEST 3 — Invalid blood group
    Expected: validation error (422).
    """
    login_resp = await client.post(
        "/api/auth/login",
        json={"username_or_email": "hospital@organmatch.in", "password": TEST_AUTH_SECRET}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "name": "Bad Blood Recipient",
        "age": 25,
        "blood_group": "XYZ_INVALID",
        "required_organ": "KIDNEY"
    }

    resp = await client.post("/api/recipients/", json=payload, headers=headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_recipient_invalid_priority_urgency(client: AsyncClient, seed_data):
    """
    TEST 4 — Invalid priority/urgency
    Expected: validation error (422).
    """
    login_resp = await client.post(
        "/api/auth/login",
        json={"username_or_email": "hospital@organmatch.in", "password": TEST_AUTH_SECRET}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "name": "Bad Urgency Recipient",
        "age": 25,
        "blood_group": "O+",
        "required_organ": "KIDNEY",
        "priority": "SUPER_HIGH_INVALID",
        "urgency": "EXTREME_INVALID"
    }

    resp = await client.post("/api/recipients/", json=payload, headers=headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_recipient_unauthorized_user(client: AsyncClient, seed_data):
    """
    TEST 5 — Unauthorized user
    Expected: 401 without auth, 403 when role lacks CREATE_RECIPIENT permission (e.g. Doctor).
    """
    payload = {
        "name": "Unauthorized Test",
        "age": 40,
        "blood_group": "A+",
        "required_organ": "KIDNEY"
    }

    # Without token -> 401
    resp_no_auth = await client.post("/api/recipients/", json=payload)
    assert resp_no_auth.status_code == 401

    # Login as Doctor (Doctor does not have CREATE_RECIPIENT)
    login_resp = await client.post(
        "/api/auth/login",
        json={"username_or_email": "doctor@organmatch.in", "password": TEST_AUTH_SECRET}
    )
    doc_token = login_resp.json()["access_token"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}

    resp_doc = await client.post("/api/recipients/", json=payload, headers=doc_headers)
    assert resp_doc.status_code == 403


@pytest.mark.asyncio
async def test_recipient_hospital_isolation(client: AsyncClient, seed_data):
    """
    TEST 6 — Hospital isolation
    A coordinator must not be able to create a recipient under another hospital.
    """
    login_resp = await client.post(
        "/api/auth/login",
        json={"username_or_email": "hospital@organmatch.in", "password": TEST_AUTH_SECRET}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Hospital B ID from seed
    hospital_b_id = str(seed_data["hospitals"]["B"].id)

    payload = {
        "name": "Isolated Recipient",
        "age": 40,
        "blood_group": "B+",
        "required_organ": "KIDNEY",
        "hospital_id": hospital_b_id
    }

    resp = await client.post("/api/recipients/", json=payload, headers=headers)
    assert resp.status_code == 403
    data = resp.json()
    assert data["error"]["code"] == "ABAC_VIOLATION"


@pytest.mark.asyncio
async def test_recipient_duplicate_recipient_code(client: AsyncClient, seed_data):
    """
    TEST 7 — Duplicate/invalid recipient code
    Expected: 400 Bad Request on duplicate recipient_code.
    """
    login_resp = await client.post(
        "/api/auth/login",
        json={"username_or_email": "hospital@organmatch.in", "password": TEST_AUTH_SECRET}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    hospital_a_id = str(seed_data["hospitals"]["A"].id)
    dup_code = f"REC-DUP-{uuid.uuid4().hex[:6].upper()}"

    payload1 = {
        "recipient_code": dup_code,
        "name": "First Recipient",
        "age": 35,
        "blood_group": "O+",
        "required_organ": "HEART",
        "hospital_id": hospital_a_id
    }
    resp1 = await client.post("/api/recipients/", json=payload1, headers=headers)
    assert resp1.status_code == 201

    # Attempt to create another with same recipient_code
    payload2 = {
        "recipient_code": dup_code,
        "name": "Second Recipient",
        "age": 42,
        "blood_group": "A+",
        "required_organ": "KIDNEY",
        "hospital_id": hospital_a_id
    }
    resp2 = await client.post("/api/recipients/", json=payload2, headers=headers)
    assert resp2.status_code == 400
    assert "already registered" in resp2.json()["error"]["message"]
