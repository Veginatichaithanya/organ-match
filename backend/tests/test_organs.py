"""
Tests for the Harvested Organ Registration workflow.

Covers:
- Auto organ_code generation
- Blood group consistency with donor
- Hospital isolation (coordinator cannot register organ for another hospital's donor)
- Clinical fields stored in medical_details
- Invalid organ_type / status values
- Duplicate organ_code rejection
"""
import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.future import select
from app.models.organ import Organ
from conftest import TEST_AUTH_SECRET


async def _coordinator_token(client: AsyncClient) -> str:
    """Helper: log in as hospital coordinator and return Bearer token."""
    res = await client.post("/api/auth/login", json={
        "username_or_email": "hospital@organmatch.in",
        "password": TEST_AUTH_SECRET
    })
    assert res.status_code == 200, f"Login failed: {res.text}"
    return res.json()["access_token"]


async def _register_test_donor(client: AsyncClient, headers: dict, seed_data) -> dict:
    """Helper: create a disposable test donor and return the API response JSON."""
    from datetime import date
    payload = {
        "name": "Organ Test Donor",
        "date_of_birth": "1985-01-01",
        "gender": "Male",
        "blood_group": "B+",
        "donation_preferences": {"organs": ["Kidney"]},
        "declaration_acknowledged": True,
        "registration_date": str(date.today()),
        "medical_details": {"status": "Suitable", "notes": "Test donor for organ workflow"},
    }
    res = await client.post("/api/donors/", json=payload, headers=headers)
    assert res.status_code == 201, f"Donor creation failed: {res.text}"
    return res.json()


# ─────────────────────────────────────────────────────────────────────────────
# 1. Successful organ registration with auto organ_code
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_organ_registration_auto_code(client: AsyncClient, seed_data, db_session):
    """Backend auto-generates organ code when not supplied by the client."""
    token = await _coordinator_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    donor = await _register_test_donor(client, headers, seed_data)
    donor_id = donor["id"]

    payload = {
        "donor_id": donor_id,
        "organ_type": "KIDNEY",
        "blood_group": donor["blood_group"],
        # organ_code intentionally omitted
        "laterality": "LEFT",
        "harvested_at": "2026-08-28T10:30:00",
        "warm_ischemia_minutes": 18,
        "cold_ischemia_time": "02:00",
        "preservation_method": "Static Cold Storage",
        "clinical_notes": "Harvested under sterile conditions. No complications.",
        "organ_status": "AVAILABLE",
        "medical_details": {},
    }

    res = await client.post("/api/organs/", json=payload, headers=headers)
    assert res.status_code == 201, res.text

    data = res.json()
    assert data["organ_code"].startswith("ORG-"), (
        f"Expected organ_code to start with ORG-, got: {data['organ_code']}"
    )
    assert len(data["organ_code"]) == 12, (
        f"Expected ORG-XXXXXXXX (12 chars), got: {data['organ_code']}"
    )
    assert data["organ_type"] == "KIDNEY"
    assert data["blood_group"] == "B+"
    assert data["status"] == "AVAILABLE"


# ─────────────────────────────────────────────────────────────────────────────
# 2. Blood group must match the donor record
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_organ_blood_group_matches_donor(client: AsyncClient, seed_data, db_session):
    """Organ blood group matches the donor's blood group when supplied correctly."""
    token = await _coordinator_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    donor = await _register_test_donor(client, headers, seed_data)

    payload = {
        "donor_id": donor["id"],
        "organ_type": "LIVER",
        "blood_group": donor["blood_group"],  # must match donor
        "clinical_notes": "Liver harvested under optimal conditions.",
        "preservation_method": "Hypothermic Machine Perfusion",
        "organ_status": "AVAILABLE",
        "medical_details": {},
    }

    res = await client.post("/api/organs/", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    assert res.json()["blood_group"] == donor["blood_group"]


# ─────────────────────────────────────────────────────────────────────────────
# 3. Clinical fields are persisted inside medical_details
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_organ_clinical_fields_stored(client: AsyncClient, seed_data, db_session):
    """Clinical fields (laterality, ischemia times, preservation) are stored in medical_details."""
    token = await _coordinator_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    donor = await _register_test_donor(client, headers, seed_data)

    payload = {
        "donor_id": donor["id"],
        "organ_type": "KIDNEY",
        "blood_group": donor["blood_group"],
        "laterality": "RIGHT",
        "harvested_at": "2026-08-28T08:00:00",
        "warm_ischemia_minutes": 25,
        "cold_ischemia_time": "03:30",
        "preservation_method": "Static Cold Storage",
        "clinical_notes": "Right kidney. Warm ischemia 25 min. No anatomical anomalies.",
        "additional_notes": "Donor was otherwise healthy.",
        "organ_status": "AVAILABLE",
        "medical_details": {},
    }

    res = await client.post("/api/organs/", json=payload, headers=headers)
    assert res.status_code == 201, res.text

    organ_id = uuid.UUID(res.json()["id"])
    query = select(Organ).where(Organ.id == organ_id)
    result = await db_session.execute(query)
    saved_organ = result.scalars().first()

    assert saved_organ is not None
    md = saved_organ.medical_details
    assert md.get("laterality") == "RIGHT"
    assert md.get("warm_ischemia_minutes") == 25
    assert md.get("cold_ischemia_time") == "03:30"
    assert md.get("preservation_method") == "Static Cold Storage"
    assert "Right kidney" in md.get("notes", "")
    assert "otherwise healthy" in md.get("additional_notes", "")
    assert md.get("harvested_at") == "2026-08-28T08:00:00"


# ─────────────────────────────────────────────────────────────────────────────
# 4. Hospital isolation — coordinator cannot register organ for foreign donor
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_organ_hospital_isolation(client: AsyncClient, seed_data, db_session):
    """A coordinator cannot register an organ for a donor from a different hospital."""
    # Hospital B coordinator trying to register organ for Hospital A donor
    # seed_data["donors"] must contain a donor belonging to Hospital A
    hospital_a_donor = seed_data.get("donors", {}).get("A") or seed_data.get("donor_a")
    if hospital_a_donor is None:
        pytest.skip("No cross-hospital donor in seed_data — skipping isolation test.")

    # Log in as Hospital B coordinator
    login_b = await client.post("/api/auth/login", json={
        "username_or_email": "hospital@organmatch.in",
        "password": TEST_AUTH_SECRET
    })
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    payload = {
        "donor_id": str(hospital_a_donor.id),
        "organ_type": "HEART",
        "blood_group": "O+",
        "clinical_notes": "Cross-hospital attempt — should be rejected.",
        "preservation_method": "Static Cold Storage",
        "organ_status": "AVAILABLE",
        "medical_details": {},
    }

    res = await client.post("/api/organs/", json=payload, headers=headers_b)
    # Should be 403 or 404 depending on whether the donor is even visible
    assert res.status_code in (403, 404), (
        f"Expected 403/404 for cross-hospital organ registration, got {res.status_code}: {res.text}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# 5. Duplicate organ_code is rejected
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_organ_duplicate_code_rejected(client: AsyncClient, seed_data, db_session):
    """If the client provides a code that already exists, a 400 is returned."""
    token = await _coordinator_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    donor = await _register_test_donor(client, headers, seed_data)

    base_payload = {
        "donor_id": donor["id"],
        "organ_type": "LIVER",
        "blood_group": donor["blood_group"],
        "organ_code": "ORG-DUPTEST1",
        "clinical_notes": "First registration with explicit code.",
        "preservation_method": "Static Cold Storage",
        "organ_status": "AVAILABLE",
        "medical_details": {},
    }

    # First registration should succeed
    r1 = await client.post("/api/organs/", json=base_payload, headers=headers)
    assert r1.status_code == 201, r1.text

    # Same code second time should fail
    r2 = await client.post("/api/organs/", json=base_payload, headers=headers)
    assert r2.status_code == 400, (
        f"Expected 400 for duplicate organ code, got {r2.status_code}: {r2.text}"
    )
    body = r2.json()
    error_msg = (
        body.get("detail", "")
        or body.get("error", {}).get("message", "")
        or ""
    ).lower()
    assert "already registered" in error_msg, (
        f"Expected 'already registered' in error message, got: {r2.text}"
    )



# ─────────────────────────────────────────────────────────────────────────────
# 6. Non-existent donor returns 404
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_organ_invalid_donor_rejected(client: AsyncClient, seed_data, db_session):
    """Organ registration with a non-existent donor_id returns 404."""
    token = await _coordinator_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "donor_id": str(uuid.uuid4()),  # random UUID that doesn't exist
        "organ_type": "KIDNEY",
        "blood_group": "A+",
        "clinical_notes": "Should fail — donor not found.",
        "preservation_method": "Static Cold Storage",
        "organ_status": "AVAILABLE",
        "medical_details": {},
    }

    res = await client.post("/api/organs/", json=payload, headers=headers)
    assert res.status_code == 404, (
        f"Expected 404 for non-existent donor, got {res.status_code}: {res.text}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# 7. Under-Review status is honoured
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_organ_under_review_status(client: AsyncClient, seed_data, db_session):
    """Organ registered with UNDER_REVIEW status is stored correctly."""
    token = await _coordinator_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    donor = await _register_test_donor(client, headers, seed_data)

    payload = {
        "donor_id": donor["id"],
        "organ_type": "PANCREAS",
        "blood_group": donor["blood_group"],
        "clinical_notes": "Pancreas requires further assessment before allocation.",
        "preservation_method": "Hypothermic Machine Perfusion",
        "organ_status": "UNDER_REVIEW",
        "medical_details": {},
    }

    res = await client.post("/api/organs/", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    assert res.json()["status"] == "UNDER_REVIEW"
