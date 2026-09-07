import pytest
import secrets
from httpx import AsyncClient
from fastapi import status
import uuid

@pytest.mark.asyncio
async def test_doctor_overview_and_assessments(
    client: AsyncClient,
    doctor_token_headers: dict
):
    # Test Doctor Overview
    response = await client.get("/api/doctor/overview", headers=doctor_token_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "donors_pending_review" in data
    assert "recent_assessments" in data

    # Test Doctor List Donors
    response = await client.get("/api/doctor/donors", headers=doctor_token_headers)
    assert response.status_code == status.HTTP_200_OK

    # Test Doctor List Organs
    response = await client.get("/api/doctor/organs", headers=doctor_token_headers)
    assert response.status_code == status.HTTP_200_OK

    # Test Doctor List Recipients
    response = await client.get("/api/doctor/recipients", headers=doctor_token_headers)
    assert response.status_code == status.HTTP_200_OK

    # Test Doctor List Matches
    response = await client.get("/api/doctor/matches", headers=doctor_token_headers)
    assert response.status_code == status.HTTP_200_OK

@pytest.mark.asyncio
async def test_doctor_restrictions(
    client: AsyncClient,
    doctor_token_headers: dict
):
    # Doctor attempting to create a donor MUST be rejected with 403 Forbidden (requires CREATE_DONOR)
    response = await client.post("/api/donors/", json={
        "donor_code": "D_DOCTOR_TEST",
        "name": "Jane Donor",
        "age": 30,
        "blood_group": "O+",
        "hospital_id": str(uuid.uuid4())
    }, headers=doctor_token_headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN

    # Doctor attempting user creation MUST be rejected with 403 Forbidden (requires CREATE_USER)
    response = await client.post("/api/admin/users/", json={
        "email": "hacker@test.com",
        "username": "hacker",
        "password": secrets.token_hex(12),
        "role_code": "admin"
    }, headers=doctor_token_headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN


