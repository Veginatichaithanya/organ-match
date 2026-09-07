"""
Comprehensive Tests for Post-Quantum Cryptography (PQC) Security Layer & Regression Verifications
"""
import pytest
from httpx import AsyncClient
from app.security.pqc.kem import (
    generate_keypair,
    encapsulate,
    decapsulate,
    benchmark_ml_kem,
)
from app.security.pqc import pqc_service, pqc_key_manager
from app.blockchain.fabric_gateway import fabric_gateway
from app.security.authentication import create_access_token
from conftest import TEST_AUTH_SECRET


def test_pqc_key_generation():
    pk, sk = generate_keypair()
    assert isinstance(pk, bytes)
    assert isinstance(sk, bytes)
    assert len(pk) == 1184  # NIST ML-KEM-768 public key size
    assert len(sk) == 2400  # NIST ML-KEM-768 private key size


def test_pqc_encapsulation():
    pk, sk = generate_keypair()
    ss, ct = encapsulate(pk)
    assert isinstance(ss, bytes)
    assert isinstance(ct, bytes)
    assert len(ss) == 32    # 256-bit symmetric shared secret
    assert len(ct) == 1088  # NIST ML-KEM-768 ciphertext size


def test_pqc_decapsulation():
    pk, sk = generate_keypair()
    ss1, ct = encapsulate(pk)
    ss2 = decapsulate(sk, ct)
    assert isinstance(ss2, bytes)
    assert len(ss2) == 32
    assert ss1 == ss2


def test_pqc_shared_secret_match():
    pqc_key_manager.ensure_keypair()
    res = pqc_service.run_verification_test()
    assert res.algorithm == "ML-KEM-768"
    assert res.encapsulation == "SUCCESS"
    assert res.decapsulation == "SUCCESS"
    assert res.shared_secret_match is True


def test_pqc_invalid_ciphertext():
    pk, sk = generate_keypair()
    ss1, ct = encapsulate(pk)
    # Corrupt ciphertext bytes
    invalid_ct = bytearray(ct)
    invalid_ct[0] ^= 0xFF
    invalid_ct = bytes(invalid_ct)
    
    # NIST FIPS 203 implicit rejection returns non-matching shared secret or raises ValueError
    try:
        ss_bad = decapsulate(sk, invalid_ct)
        assert ss_bad != ss1
    except ValueError:
        pass


def test_pqc_private_key_not_exposed():
    pqc_key_manager.ensure_keypair()
    status = pqc_service.get_status()
    status_dict = status.model_dump()
    assert "private_key" not in status_dict
    assert "secret_key" not in status_dict
    assert "shared_secret" not in status_dict
    assert isinstance(status.enabled, bool)
    assert status.algorithm == "ML-KEM-768"
    assert status.key_status in ["AVAILABLE", "UNINITIALIZED"]
    assert isinstance(status.public_key_available, bool)


def test_pqc_benchmark_execution():
    res = benchmark_ml_kem(iterations=2)
    assert res["algorithm"] == "ML-KEM-768"
    assert res["keygen_ms"] > 0
    assert res["encapsulation_ms"] > 0
    assert res["decapsulation_ms"] > 0
    assert res["shared_secret_match"] is True


@pytest.mark.asyncio
async def test_pqc_admin_authorization(client: AsyncClient, seed_data):
    admin_login = await client.post("/api/auth/login", json={"username_or_email": "admin@organmatch.in", "password": TEST_AUTH_SECRET})
    admin_token = admin_login.json()["access_token"]

    coord_login = await client.post("/api/auth/login", json={"username_or_email": "hospital@organmatch.in", "password": TEST_AUTH_SECRET})
    coord_token = coord_login.json()["access_token"]

    # Admin access allowed
    resp = await client.get(
        "/api/admin/security/pqc/status",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["algorithm"] == "ML-KEM-768"
    assert isinstance(data["enabled"], bool)
    assert "private_key" not in data

    # Non-admin access rejected with 403
    resp_coord = await client.get(
        "/api/admin/security/pqc/status",
        headers={"Authorization": f"Bearer {coord_token}"}
    )
    assert resp_coord.status_code in (401, 403)


@pytest.mark.asyncio
async def test_existing_login_still_works(client: AsyncClient, seed_data):
    resp = await client.post(
        "/api/auth/login",
        json={"username_or_email": "hospital@organmatch.in", "password": TEST_AUTH_SECRET}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data


@pytest.mark.asyncio
async def test_existing_jwt_still_works(client: AsyncClient, seed_data):
    admin_user = seed_data["users"]["admin"]
    admin_token = create_access_token(data={"sub": str(admin_user.id), "role": "ADMIN"})
    resp = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_existing_rbac_still_works(client: AsyncClient, seed_data):
    doctor_user = seed_data["users"]["doctor"]
    doctor_token = create_access_token(data={"sub": str(doctor_user.id), "role": "DOCTOR"})

    # Doctor accessing doctor overview allowed
    resp = await client.get(
        "/api/doctor/overview",
        headers={"Authorization": f"Bearer {doctor_token}"}
    )
    assert resp.status_code == 200

    # Doctor accessing admin endpoints rejected
    resp_admin = await client.get(
        "/api/admin/users/",
        headers={"Authorization": f"Bearer {doctor_token}"}
    )
    assert resp_admin.status_code in (401, 403)


def test_existing_fabric_workflow_still_works():
    assert fabric_gateway is not None
    assert hasattr(fabric_gateway, "configured")
    assert hasattr(fabric_gateway, "connected")
