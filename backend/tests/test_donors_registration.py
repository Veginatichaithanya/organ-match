import pytest
import uuid
from datetime import date, timedelta
from httpx import AsyncClient
from app.models.donor import Donor
from sqlalchemy.future import select
from conftest import TEST_AUTH_SECRET

@pytest.mark.asyncio
async def test_coordinator_register_donor_success(client: AsyncClient, seed_data, db_session):
    # Login as Hospital Coordinator
    login_res = await client.post("/api/auth/login", json={
        "username_or_email": "hospital@organmatch.in",
        "password": TEST_AUTH_SECRET
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "name": "Sarah Connor",
        "date_of_birth": "1995-08-28",
        "gender": "Female",
        "contact_number": "+91 9876543210",
        "residential_address": "42 Cyberdyne Way, Sector 5",
        "blood_group": "O+",
        "donation_preferences": {
            "organs": ["Kidney", "Liver"],
            "tissues": ["Corneas"],
            "other_organs": None,
            "other_tissues": None
        },
        "declaration_acknowledged": True,
        "registration_date": str(date.today()),
        "hla_information": {"raw": "A2,A24;B7,B44;DR4,DR7"},
        "medical_details": {"status": "Suitable", "notes": "Healthy candidate"}
    }

    res = await client.post("/api/donors/", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["name"] == "Sarah Connor"
    assert data["donor_code"].startswith("DNR-")
    assert data["gender"] == "Female"
    assert data["contact_number"] == "+91 9876543210"
    assert data["residential_address"] == "42 Cyberdyne Way, Sector 5"
    assert data["date_of_birth"] == "1995-08-28"
    assert data["age"] > 0
    assert data["donation_preferences"]["organs"] == ["Kidney", "Liver"]
    assert data["declaration_acknowledged"] is True

    # Check persistence in database
    donor_id = uuid.UUID(data["id"])
    query = select(Donor).where(Donor.id == donor_id)
    result = await db_session.execute(query)
    saved_donor = result.scalars().first()
    assert saved_donor is not None
    assert saved_donor.name == "Sarah Connor"
    assert saved_donor.hospital_id == seed_data["hospitals"]["A"].id


@pytest.mark.asyncio
async def test_coordinator_register_indian_donor_rohit_sharma(client: AsyncClient, seed_data, db_session):
    login_res = await client.post("/api/auth/login", json={
        "username_or_email": "hospital@organmatch.in",
        "password": TEST_AUTH_SECRET
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "name": "Rohit Sharma",
        "date_of_birth": "1990-08-15",
        "gender": "Male",
        "blood_group": "A+",
        "contact_number": "+91 98765 43210",
        "residential_address": "45, Green Park Colony, Lajpat Nagar 2, New Delhi, Delhi - 110024, India",
        "donation_preferences": {
            "organs": ["Kidney"],
            "tissues": []
        },
        "declaration_acknowledged": True,
        "registration_date": str(date.today())
    }

    res = await client.post("/api/donors/", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["name"] == "Rohit Sharma"
    assert data["gender"] == "Male"
    assert data["blood_group"] == "A+"
    assert data["contact_number"] == "+91 98765 43210"
    assert data["residential_address"] == "45, Green Park Colony, Lajpat Nagar 2, New Delhi, Delhi - 110024, India"
    assert data["date_of_birth"] == "1990-08-15"
    assert data["declaration_acknowledged"] is True

    # Verify DB persistence
    donor_id = uuid.UUID(data["id"])
    query = select(Donor).where(Donor.id == donor_id)
    result = await db_session.execute(query)
    saved = result.scalars().first()
    assert saved is not None
    assert saved.name == "Rohit Sharma"
    assert saved.blood_group == "A+"

@pytest.mark.asyncio
async def test_coordinator_register_donor_validation_failures(client: AsyncClient, seed_data):
    login_res = await client.post("/api/auth/login", json={
        "username_or_email": "hospital@organmatch.in",
        "password": TEST_AUTH_SECRET
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Missing name
    res = await client.post("/api/donors/", json={
        "name": "",
        "date_of_birth": "1995-08-28",
        "gender": "Male",
        "declaration_acknowledged": True
    }, headers=headers)
    assert res.status_code in [400, 422]

    # 2. Future date of birth
    tomorrow = date.today() + timedelta(days=1)
    res = await client.post("/api/donors/", json={
        "name": "John Doe",
        "date_of_birth": str(tomorrow),
        "gender": "Male",
        "declaration_acknowledged": True
    }, headers=headers)
    assert res.status_code in [400, 422]

    # 3. Future registration date
    res = await client.post("/api/donors/", json={
        "name": "John Doe",
        "date_of_birth": "1990-01-01",
        "gender": "Male",
        "registration_date": str(tomorrow),
        "declaration_acknowledged": True
    }, headers=headers)
    assert res.status_code in [400, 422]

    # 4. Declaration not acknowledged
    res = await client.post("/api/donors/", json={
        "name": "John Doe",
        "date_of_birth": "1990-01-01",
        "gender": "Male",
        "declaration_acknowledged": False
    }, headers=headers)
    assert res.status_code in [400, 422]

    # 5. Other Organs selected without specification
    res = await client.post("/api/donors/", json={
        "name": "John Doe",
        "date_of_birth": "1990-01-01",
        "gender": "Male",
        "donation_preferences": {
            "organs": ["Other Organs"],
            "tissues": [],
            "other_organs": ""
        },
        "declaration_acknowledged": True
    }, headers=headers)
    assert res.status_code in [400, 422]

    # 6. Other Tissues selected without specification
    res = await client.post("/api/donors/", json={
        "name": "John Doe",
        "date_of_birth": "1990-01-01",
        "gender": "Male",
        "donation_preferences": {
            "organs": [],
            "tissues": ["Other Tissues"],
            "other_tissues": ""
        },
        "declaration_acknowledged": True
    }, headers=headers)
    assert res.status_code in [400, 422]

    # 7. Preferences provided but empty (no organs and no tissues)
    res = await client.post("/api/donors/", json={
        "name": "John Doe",
        "date_of_birth": "1990-01-01",
        "gender": "Male",
        "donation_preferences": {
            "organs": [],
            "tissues": []
        },
        "declaration_acknowledged": True
    }, headers=headers)
    assert res.status_code in [400, 422]

@pytest.mark.asyncio
async def test_coordinator_hospital_isolation_enforced(client: AsyncClient, seed_data):
    login_res = await client.post("/api/auth/login", json={
        "username_or_email": "hospital@organmatch.in",
        "password": TEST_AUTH_SECRET
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Attempt to submit another hospital's ID
    hosp_b_id = str(seed_data["hospitals"]["B"].id)
    res = await client.post("/api/donors/", json={
        "name": "Intruder Donor",
        "date_of_birth": "1992-05-15",
        "gender": "Female",
        "hospital_id": hosp_b_id,
        "declaration_acknowledged": True
    }, headers=headers)

    # Either rejected by ABAC or overridden to coordinator's hospital A
    if res.status_code == 201:
        data = res.json()
        assert data["hospital_id"] == str(seed_data["hospitals"]["A"].id)
    else:
        assert res.status_code in [400, 403]
