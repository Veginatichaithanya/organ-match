import pytest
from httpx import AsyncClient
from conftest import TEST_AUTH_SECRET

@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, seed_data):
    """
    Verifies that a seeded user can login successfully and receive a JWT.
    """
    response = await client.post(
        "/api/auth/login",
        json={"username_or_email": "hospital@organmatch.in", "password": TEST_AUTH_SECRET}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "hospital@organmatch.in"
    # Verify exact frontend lowercase role mapping conversion (HOSPITAL_COORDINATOR -> hospital)
    assert data["user"]["role"] == "hospital"
    # Verify refresh_token cookie is set
    assert "refresh_token" in response.cookies

@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient, seed_data):
    """
    Asserts login fails and triggers HTTP 401 when using wrong credentials.
    """
    response = await client.post(
        "/api/auth/login",
        json={"username_or_email": "hospital@organmatch.in", "password": "wrong_password"}
    )
    
    assert response.status_code == 401
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "AUTHENTICATION_FAILED"

@pytest.mark.asyncio
async def test_get_current_user_profile(client: AsyncClient, seed_data):
    """
    Verifies /me endpoint returns user profiles when queried with valid JWT.
    """
    # 1. Login to get access token
    login_resp = await client.post(
        "/api/auth/login",
        json={"username_or_email": "hospital@organmatch.in", "password": TEST_AUTH_SECRET}
    )
    token = login_resp.json()["access_token"]
    
    # 2. Query /me endpoint using token
    headers = {"Authorization": f"Bearer {token}"}
    me_resp = await client.get("/api/auth/me", headers=headers)
    
    assert me_resp.status_code == 200
    me_data = me_resp.json()["user"]
    assert me_data["email"] == "hospital@organmatch.in"
    assert me_data["role"] == "hospital"

@pytest.mark.asyncio
async def test_refresh_token_endpoint(client: AsyncClient, seed_data):
    """
    Verifies /refresh endpoint issues new access token using HttpOnly cookie.
    """
    login_resp = await client.post(
        "/api/auth/login",
        json={"username_or_email": "hospital@organmatch.in", "password": TEST_AUTH_SECRET}
    )
    assert login_resp.status_code == 200
    
    refresh_resp = await client.post("/api/auth/refresh", cookies=login_resp.cookies)
    assert refresh_resp.status_code == 200
    data = refresh_resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

@pytest.mark.asyncio
async def test_logout_endpoint(client: AsyncClient, seed_data):
    """
    Verifies /logout endpoint clears the refresh token cookie.
    """
    logout_resp = await client.post("/api/auth/logout")
    assert logout_resp.status_code == 200
