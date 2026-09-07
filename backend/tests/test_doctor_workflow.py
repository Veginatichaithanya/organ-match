import pytest
import uuid
from httpx import AsyncClient
from app.models.donor import Donor
from app.models.organ import Organ
from app.models.recipient import Recipient
from app.models.match import Match
from app.models.medical_assessment import MedicalAssessment


@pytest.mark.asyncio
async def test_doctor_overview(client: AsyncClient, doctor_token_headers: dict, seed_data: dict):
    resp = await client.get(
        "/api/doctor/overview",
        headers=doctor_token_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "donors_pending_review" in data
    assert "recipients_pending_review" in data
    assert "organs_available" in data
    assert "matches_pending" in data
    assert "priority_reviews" in data
    assert isinstance(data["priority_reviews"], list)


@pytest.mark.asyncio
async def test_doctor_targets(client: AsyncClient, doctor_token_headers: dict, seed_data: dict):
    resp = await client.get(
        "/api/doctor/targets",
        headers=doctor_token_headers
    )
    assert resp.status_code == 200
    targets = resp.json()
    assert isinstance(targets, list)


@pytest.mark.asyncio
async def test_doctor_create_and_list_assessment(client: AsyncClient, doctor_token_headers: dict, seed_data: dict, db_session):
    hosp_a = seed_data["hospitals"]["A"]
    doctor_user = seed_data["users"]["doctor"]

    donor = Donor(
        hospital_id=hosp_a.id,
        donor_code="TEST-DOC-DNR-1",
        name="Test Donor",
        age=30,
        blood_group="A+",
        hla_information={"A": "02,24"},
        medical_details={"status": "Suitable"},
        created_by=doctor_user.id,
        updated_by=doctor_user.id,
    )
    db_session.add(donor)
    await db_session.commit()
    await db_session.refresh(donor)

    # Post assessment
    payload = {
        "entity_type": "Donor",
        "entity_id": str(donor.id),
        "suitability": "APPROVED",
        "risk_level": "LOW",
        "clinical_notes": "All viral markers negative, renal parameters optimal.",
        "recommendation": "Cleared for matching",
    }
    resp = await client.post(
        "/api/doctor/assessments",
        json=payload,
        headers=doctor_token_headers
    )
    assert resp.status_code == 201
    ass_data = resp.json()
    assert ass_data["suitability"] == "APPROVED"
    assert ass_data["risk_level"] == "LOW"

    # List assessments
    list_resp = await client.get(
        f"/api/doctor/assessments?entity_type=Donor&entity_id={donor.id}",
        headers=doctor_token_headers
    )
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert len(items) >= 1
    assert items[0]["suitability"] == "APPROVED"


@pytest.mark.asyncio
async def test_doctor_match_review_action(client: AsyncClient, doctor_token_headers: dict, seed_data: dict, db_session):
    hosp_a = seed_data["hospitals"]["A"]
    doctor_user = seed_data["users"]["doctor"]

    donor = Donor(
        hospital_id=hosp_a.id,
        donor_code="TEST-DOC-DNR-2",
        name="Match Test Donor",
        age=35,
        blood_group="O+",
        created_by=doctor_user.id,
        updated_by=doctor_user.id,
    )
    db_session.add(donor)
    await db_session.flush()

    organ = Organ(
        donor_id=donor.id,
        organ_code="TEST-ORG-2",
        organ_type="KIDNEY",
        blood_group="O+",
        status="AVAILABLE",
        created_by=doctor_user.id,
        updated_by=doctor_user.id,
    )
    db_session.add(organ)
    await db_session.flush()

    recipient = Recipient(
        hospital_id=hosp_a.id,
        recipient_code="TEST-REC-2",
        name="Match Test Recipient",
        age=40,
        blood_group="O+",
        required_organ="KIDNEY",
        created_by=doctor_user.id,
        updated_by=doctor_user.id,
    )
    db_session.add(recipient)
    await db_session.flush()

    match_obj = Match(
        organ_id=organ.id,
        recipient_id=recipient.id,
        compatibility_score=94.5,
        scoring_breakdown={"blood": 25, "medical": 28, "tissue": 23, "priority": 18.5},
        rank=1,
        status="PENDING",
    )
    db_session.add(match_obj)
    await db_session.commit()
    await db_session.refresh(match_obj)

    # Doctor views match details
    detail_resp = await client.get(
        f"/api/doctor/matches/{match_obj.id}",
        headers=doctor_token_headers
    )
    assert detail_resp.status_code == 200
    m_data = detail_resp.json()
    assert m_data["compatibility_score"] == 95 or m_data["compatibility_score"] == 94

    # Doctor performs match review recommendation
    review_resp = await client.post(
        f"/api/doctor/matches/{match_obj.id}/review",
        json={
            "suitability": "APPROVED",
            "risk_level": "LOW",
            "recommendation": "RECOMMEND_FOR_ALLOCATION",
            "clinical_notes": "Immunologically compatible. Crossmatch negative.",
        },
        headers=doctor_token_headers
    )
    assert review_resp.status_code == 200
    res_data = review_resp.json()
    assert res_data["success"] is True

    # Check history
    hist_resp = await client.get(
        "/api/doctor/history",
        headers=doctor_token_headers
    )
    assert hist_resp.status_code == 200
    hist_items = hist_resp.json()
    assert len(hist_items) >= 1

