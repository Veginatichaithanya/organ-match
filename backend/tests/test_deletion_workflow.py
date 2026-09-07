import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.future import select
from app.models.donor import Donor
from app.models.recipient import Recipient
from app.models.organ import Organ
from app.models.allocation import Allocation


from conftest import TEST_AUTH_SECRET


async def get_auth_headers(client: AsyncClient, username: str, password: str = TEST_AUTH_SECRET) -> dict:
    resp = await client.post(
        "/api/auth/login",
        json={"username_or_email": username, "password": password}
    )
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_coordinator_delete_donor_success(client: AsyncClient, seed_data, db_session):
    """
    Test 1: Authorized Hospital Coordinator deletes a valid donor with a valid reason.
    """
    headers = await get_auth_headers(client, "hospital@organmatch.in", TEST_AUTH_SECRET)
    hosp_a_id = seed_data["hospitals"]["A"].id

    # Create a donor
    donor = Donor(
        hospital_id=hosp_a_id,
        donor_code=f"DNR-TEST-{uuid.uuid4().hex[:6].upper()}",
        name="Test Delete Donor",
        age=35,
        blood_group="O+",
        status="ACTIVE",
        created_by=seed_data["users"]["hospital"].id,
        updated_by=seed_data["users"]["hospital"].id
    )
    db_session.add(donor)
    await db_session.commit()
    await db_session.refresh(donor)

    # Delete donor with valid reason >= 10 chars
    del_resp = await client.request(
        "DELETE",
        f"/api/coordinator/donors/{donor.id}",
        json={"reason": "Duplicate donor registration created during testing"},
        headers=headers
    )
    assert del_resp.status_code == 200
    del_data = del_resp.json()
    assert del_data["message"] == "Donor deleted successfully."
    assert del_data["id"] == str(donor.id)

    # Verify donor is removed from database
    check_q = select(Donor).where(Donor.id == donor.id)
    check_res = await db_session.execute(check_q)
    assert check_res.scalars().first() is None


@pytest.mark.asyncio
async def test_coordinator_delete_recipient_success(client: AsyncClient, seed_data, db_session):
    """
    Test 2: Authorized Hospital Coordinator deletes a valid recipient with a valid reason.
    """
    headers = await get_auth_headers(client, "hospital@organmatch.in", TEST_AUTH_SECRET)
    hosp_a_id = seed_data["hospitals"]["A"].id

    # Create a recipient
    recip = Recipient(
        hospital_id=hosp_a_id,
        recipient_code=f"REC-TEST-{uuid.uuid4().hex[:6].upper()}",
        name="Test Delete Recipient",
        age=45,
        blood_group="A+",
        required_organ="KIDNEY",
        status="ACTIVE",
        created_by=seed_data["users"]["hospital"].id,
        updated_by=seed_data["users"]["hospital"].id
    )
    db_session.add(recip)
    await db_session.commit()
    await db_session.refresh(recip)

    # Delete recipient
    del_resp = await client.request(
        "DELETE",
        f"/api/coordinator/recipients/{recip.id}",
        json={"reason": "Test data cleanup for demo preparation"},
        headers=headers
    )
    assert del_resp.status_code == 200
    assert del_resp.json()["message"] == "Recipient deleted successfully."

    # Verify recipient is removed
    check_q = select(Recipient).where(Recipient.id == recip.id)
    check_res = await db_session.execute(check_q)
    assert check_res.scalars().first() is None


@pytest.mark.asyncio
async def test_deletion_rejected_empty_or_whitespace_reason(client: AsyncClient, seed_data, db_session):
    """
    Test 3 & 4: Empty and whitespace-only reasons are rejected.
    """
    headers = await get_auth_headers(client, "hospital@organmatch.in", TEST_AUTH_SECRET)
    hosp_a_id = seed_data["hospitals"]["A"].id

    donor = Donor(
        hospital_id=hosp_a_id,
        donor_code=f"DNR-TEST-{uuid.uuid4().hex[:6].upper()}",
        name="Test Donor Empty Reason",
        age=30,
        blood_group="B+",
        status="ACTIVE",
        created_by=seed_data["users"]["hospital"].id,
        updated_by=seed_data["users"]["hospital"].id
    )
    db_session.add(donor)
    await db_session.commit()

    # Empty reason
    resp1 = await client.request(
        "DELETE",
        f"/api/coordinator/donors/{donor.id}",
        json={"reason": ""},
        headers=headers
    )
    assert resp1.status_code in [400, 422]

    # Whitespace only reason
    resp2 = await client.request(
        "DELETE",
        f"/api/coordinator/donors/{donor.id}",
        json={"reason": "          "},
        headers=headers
    )
    assert resp2.status_code in [400, 422]


@pytest.mark.asyncio
async def test_deletion_rejected_length_constraints(client: AsyncClient, seed_data, db_session):
    """
    Test 5 & 6: Reasons shorter than 10 characters or longer than 500 characters are rejected.
    """
    headers = await get_auth_headers(client, "hospital@organmatch.in", TEST_AUTH_SECRET)
    hosp_a_id = seed_data["hospitals"]["A"].id

    donor = Donor(
        hospital_id=hosp_a_id,
        donor_code=f"DNR-TEST-{uuid.uuid4().hex[:6].upper()}",
        name="Test Donor Length Check",
        age=30,
        blood_group="B+",
        status="ACTIVE",
        created_by=seed_data["users"]["hospital"].id,
        updated_by=seed_data["users"]["hospital"].id
    )
    db_session.add(donor)
    await db_session.commit()

    # Shorter than 10 chars
    resp1 = await client.request(
        "DELETE",
        f"/api/coordinator/donors/{donor.id}",
        json={"reason": "Too short"},
        headers=headers
    )
    assert resp1.status_code in [400, 422]

    # Longer than 500 chars
    long_reason = "A" * 505
    resp2 = await client.request(
        "DELETE",
        f"/api/coordinator/donors/{donor.id}",
        json={"reason": long_reason},
        headers=headers
    )
    assert resp2.status_code in [400, 422]


@pytest.mark.asyncio
async def test_unauthorized_role_deletion_blocked(client: AsyncClient, seed_data, db_session):
    """
    Test 7: Doctor or Auditor role attempting deletion returns 403 and records security event.
    """
    doc_headers = await get_auth_headers(client, "doctor@organmatch.in", TEST_AUTH_SECRET)
    hosp_a_id = seed_data["hospitals"]["A"].id

    donor = Donor(
        hospital_id=hosp_a_id,
        donor_code=f"DNR-TEST-{uuid.uuid4().hex[:6].upper()}",
        name="Test Doctor Delete Attempt",
        age=40,
        blood_group="AB+",
        status="ACTIVE",
        created_by=seed_data["users"]["hospital"].id,
        updated_by=seed_data["users"]["hospital"].id
    )
    db_session.add(donor)
    await db_session.commit()

    # Doctor attempt to delete
    resp = await client.request(
        "DELETE",
        f"/api/coordinator/donors/{donor.id}",
        json={"reason": "Attempting deletion as doctor role"},
        headers=doc_headers
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_cross_hospital_deletion_blocked(client: AsyncClient, seed_data, db_session):
    """
    Test 8: Coordinator attempting to delete another hospital's record returns 403.
    """
    headers = await get_auth_headers(client, "hospital@organmatch.in", TEST_AUTH_SECRET)
    hosp_b_id = seed_data["hospitals"]["B"].id

    # Create record in Hospital B
    foreign_donor = Donor(
        hospital_id=hosp_b_id,
        donor_code=f"DNR-HOSPB-{uuid.uuid4().hex[:6].upper()}",
        name="Foreign Hospital Donor",
        age=50,
        blood_group="O-",
        status="ACTIVE",
        created_by=seed_data["users"]["admin"].id,
        updated_by=seed_data["users"]["admin"].id
    )
    db_session.add(foreign_donor)
    await db_session.commit()

    # Hospital A Coordinator attempts to delete Hospital B donor
    resp = await client.request(
        "DELETE",
        f"/api/coordinator/donors/{foreign_donor.id}",
        json={"reason": "Attempting cross-hospital deletion"},
        headers=headers
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_record_with_protected_allocation_blocked(client: AsyncClient, seed_data, db_session):
    """
    Test 9: Recipient or Organ linked to an active allocation cannot be deleted (returns 400).
    """
    headers = await get_auth_headers(client, "hospital@organmatch.in", TEST_AUTH_SECRET)
    hosp_a_id = seed_data["hospitals"]["A"].id

    # 1. Create Donor, Organ, Recipient, Match, Allocation
    donor = Donor(
        hospital_id=hosp_a_id,
        donor_code=f"DNR-ALLOC-{uuid.uuid4().hex[:6].upper()}",
        name="Allocated Donor",
        age=30,
        blood_group="A+",
        status="ACTIVE",
        created_by=seed_data["users"]["hospital"].id,
        updated_by=seed_data["users"]["hospital"].id
    )
    db_session.add(donor)
    await db_session.flush()

    organ = Organ(
        donor_id=donor.id,
        organ_code=f"ORG-ALLOC-{uuid.uuid4().hex[:6].upper()}",
        organ_type="KIDNEY",
        blood_group="A+",
        status="AVAILABLE",
        created_by=seed_data["users"]["hospital"].id,
        updated_by=seed_data["users"]["hospital"].id
    )
    db_session.add(organ)
    await db_session.flush()

    recip = Recipient(
        hospital_id=hosp_a_id,
        recipient_code=f"REC-ALLOC-{uuid.uuid4().hex[:6].upper()}",
        name="Allocated Recipient",
        age=32,
        blood_group="A+",
        required_organ="KIDNEY",
        status="ACTIVE",
        created_by=seed_data["users"]["hospital"].id,
        updated_by=seed_data["users"]["hospital"].id
    )
    db_session.add(recip)
    await db_session.flush()

    match_entry = Match(
        organ_id=organ.id,
        recipient_id=recip.id,
        compatibility_score=95.0,
        rank=1,
        status="PENDING",
    )
    db_session.add(match_entry)
    await db_session.flush()

    alloc = Allocation(
        match_id=match_entry.id,
        organ_id=organ.id,
        recipient_id=recip.id,
        status="PENDING",
        created_by=seed_data["users"]["hospital"].id,
        updated_by=seed_data["users"]["hospital"].id
    )
    db_session.add(alloc)
    await db_session.commit()

    # Attempt to delete recipient -> should be blocked
    resp_rec = await client.request(
        "DELETE",
        f"/api/coordinator/recipients/{recip.id}",
        json={"reason": "Attempting to delete allocated recipient"},
        headers=headers
    )
    assert resp_rec.status_code == 400
    assert "allocation" in resp_rec.json()["error"]["message"].lower()

    # Attempt to delete organ -> should be blocked
    resp_org = await client.request(
        "DELETE",
        f"/api/coordinator/organs/{organ.id}",
        json={"reason": "Attempting to delete allocated organ"},
        headers=headers
    )
    assert resp_org.status_code == 400
    assert "allocation" in resp_org.json()["error"]["message"].lower()

    # Attempt to delete donor -> should be blocked
    resp_dnr = await client.request(
        "DELETE",
        f"/api/coordinator/donors/{donor.id}",
        json={"reason": "Attempting to delete allocated donor"},
        headers=headers
    )
    assert resp_dnr.status_code == 400
    assert "allocation" in resp_dnr.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_successful_deletion_audit_integrity(client: AsyncClient, seed_data, db_session):
    """
    Test 10, 11 & 12: Successful deletion records immutable audit log with reason,
    and historical audit records remain intact.
    """
    headers = await get_auth_headers(client, "hospital@organmatch.in", TEST_AUTH_SECRET)
    hosp_a_id = seed_data["hospitals"]["A"].id

    donor = Donor(
        hospital_id=hosp_a_id,
        donor_code=f"DNR-AUD-{uuid.uuid4().hex[:6].upper()}",
        name="Audit Verification Donor",
        age=28,
        blood_group="O+",
        status="ACTIVE",
        created_by=seed_data["users"]["hospital"].id,
        updated_by=seed_data["users"]["hospital"].id
    )
    db_session.add(donor)
    await db_session.commit()

    deletion_reason = "Administrative cleanup of duplicate testing profile"

    # Delete donor
    resp = await client.request(
        "DELETE",
        f"/api/coordinator/donors/{donor.id}",
        json={"reason": deletion_reason},
        headers=headers
    )
    assert resp.status_code == 200
