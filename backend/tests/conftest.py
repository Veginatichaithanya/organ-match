import asyncio
import pytest
from typing import AsyncGenerator, Generator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.hospital import Hospital
from app.models.user import Permission, Role, User
from app.security.authentication import hash_password
from sqlalchemy.future import select

# Use in-memory SQLite with static pooling for fast isolated testing
DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionMaker = async_sessionmaker(bind=engine, expire_on_commit=False)

TEST_AUTH_SECRET = "TestMockAuthSecret2026!"

import pytest_asyncio

@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Initializes in-memory database tables and metadata before tests run."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provides transactional session rollback for each individual unit test."""
    async with TestingSessionMaker() as session:
        yield session
        await session.rollback()

@pytest_asyncio.fixture(autouse=True)
async def override_db_dependency(db_session: AsyncSession):
    """Overrides app get_db dependency with test database session."""
    app.dependency_overrides[get_db] = lambda: db_session
    yield
    app.dependency_overrides.pop(get_db, None)

@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Yields a HTTPX asynchronous client to test endpoints."""
    # Use ASGI transport to query the FastAPI app in-process
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

# --- Data Seeding Fixtures ---

@pytest_asyncio.fixture
async def seed_data(db_session: AsyncSession):
    """Seeds test hospitals, permissions, roles, and default users."""
    import uuid as uuid_mod
    uid = uuid_mod.uuid4().hex[:6]

    existing_hosps = (await db_session.execute(select(Hospital))).scalars().all()
    if len(existing_hosps) >= 2:
        hosp_a, hosp_b = existing_hosps[0], existing_hosps[1]
    else:
        hosp_a = Hospital(id=uuid_mod.uuid4(), name=f"Hospital A Test {uid}", location="Delhi")
        hosp_b = Hospital(id=uuid_mod.uuid4(), name=f"Hospital B Test {uid}", location="Mumbai")
        db_session.add_all([hosp_a, hosp_b])
        await db_session.flush()

    # 2. Seed Permissions safely
    existing_perms = (await db_session.execute(select(Permission))).scalars().all()
    if existing_perms:
        perms = {p.name: p for p in existing_perms}
    else:
        permissions_list = [
            Permission(name="CREATE_DONOR", description="Can register donor"),
            Permission(name="VIEW_DONOR", description="Can view donor details"),
            Permission(name="EDIT_DONOR", description="Can edit donor"),
            Permission(name="DELETE_DONOR", description="Can delete donor"),
            Permission(name="CREATE_RECIPIENT", description="Can waitlist recipient"),
            Permission(name="VIEW_RECIPIENT", description="Can view recipient details"),
            Permission(name="EDIT_RECIPIENT", description="Can edit recipient"),
            Permission(name="DELETE_RECIPIENT", description="Can delete recipient"),
            Permission(name="VIEW_ORGAN", description="Can view organs"),
            Permission(name="EDIT_ORGAN", description="Can edit organs"),
            Permission(name="DELETE_ORGAN", description="Can delete organs"),
            Permission(name="RUN_MATCHING", description="Can run matching engine"),
            Permission(name="VIEW_MATCH", description="Can view matches"),
            Permission(name="APPROVE_ALLOCATION", description="Can approve allocations"),
            Permission(name="REJECT_ALLOCATION", description="Can reject allocations"),
            Permission(name="VIEW_AUDIT", description="Can view audit logs"),
            Permission(name="VIEW_SECURITY", description="Can view security alerts"),
            Permission(name="VERIFY_BLOCKCHAIN", description="Can run integrity verification"),
            Permission(name="MANAGE_USERS", description="Can manage users and system settings")
        ]
        db_session.add_all(permissions_list)
        await db_session.flush()
        perms = {p.name: p for p in permissions_list}

    # 3. Seed Roles safely
    existing_roles = (await db_session.execute(select(Role))).scalars().all()
    if existing_roles:
        roles_dict = {r.name: r for r in existing_roles}
        role_admin = roles_dict.get("ADMIN")
        role_hospital = roles_dict.get("HOSPITAL_COORDINATOR")
        role_doctor = roles_dict.get("DOCTOR")
        role_authority = roles_dict.get("ALLOCATION_AUTHORITY")
        role_auditor = roles_dict.get("AUDITOR")
    else:
        role_admin = Role(name="ADMIN")
        role_admin.permissions.extend(list(perms.values()))

        role_hospital = Role(name="HOSPITAL_COORDINATOR")
        role_hospital.permissions.extend([
            perms["CREATE_DONOR"], perms["VIEW_DONOR"], perms["EDIT_DONOR"], perms["DELETE_DONOR"],
            perms["CREATE_RECIPIENT"], perms["VIEW_RECIPIENT"], perms["EDIT_RECIPIENT"], perms["DELETE_RECIPIENT"],
            perms["VIEW_ORGAN"], perms["EDIT_ORGAN"], perms["DELETE_ORGAN"],
            perms["RUN_MATCHING"], perms["VIEW_MATCH"]
        ])

        role_doctor = Role(name="DOCTOR")
        role_doctor.permissions.extend([
            perms["VIEW_DONOR"], perms["VIEW_RECIPIENT"], perms["VIEW_ORGAN"],
            perms["EDIT_ORGAN"], perms["VIEW_MATCH"]
        ])

        role_authority = Role(name="ALLOCATION_AUTHORITY")
        role_authority.permissions.extend([
            perms["VIEW_DONOR"], perms["VIEW_RECIPIENT"], perms["VIEW_ORGAN"],
            perms["VIEW_MATCH"], perms["APPROVE_ALLOCATION"], perms["REJECT_ALLOCATION"]
        ])

        role_auditor = Role(name="AUDITOR")
        role_auditor.permissions.extend([
            perms["VIEW_DONOR"], perms["VIEW_RECIPIENT"], perms["VIEW_ORGAN"],
            perms["VIEW_MATCH"], perms["VIEW_AUDIT"], perms["VIEW_SECURITY"],
            perms["VERIFY_BLOCKCHAIN"]
        ])

        db_session.add_all([role_admin, role_hospital, role_doctor, role_authority, role_auditor])
        await db_session.flush()

    # 4. Seed Users safely
    existing_users = (await db_session.execute(select(User))).scalars().all()
    if existing_users:
        users_dict = {u.username: u for u in existing_users}
        admin_user = users_dict.get("admin@organmatch.in")
        hospital_user = users_dict.get("hospital@organmatch.in")
        auditor_user = users_dict.get("auditor@organmatch.in")
        doctor_user = users_dict.get("doctor@organmatch.in")
    else:
        # Admin User
        admin_user = User(
            username="admin@organmatch.in",
            email="admin@organmatch.in",
            password_hash=hash_password(TEST_AUTH_SECRET),
            hospital_id=None,
            status="Active"
        )
        admin_user.roles.append(role_admin)

        # Hospital Coordinator User (Org1 - Hospital A)
        hospital_user = User(
            username="hospital@organmatch.in",
            email="hospital@organmatch.in",
            password_hash=hash_password(TEST_AUTH_SECRET),
            hospital_id=hosp_a.id,
            status="Active"
        )
        hospital_user.roles.append(role_hospital)

        # Auditor User
        auditor_user = User(
            username="auditor@organmatch.in",
            email="auditor@organmatch.in",
            password_hash=hash_password(TEST_AUTH_SECRET),
            hospital_id=None,
            status="Active"
        )
        auditor_user.roles.append(role_auditor)

        # Doctor User (Org1 - Hospital A)
        doctor_user = User(
            username="doctor@organmatch.in",
            email="doctor@organmatch.in",
            password_hash=hash_password(TEST_AUTH_SECRET),
            hospital_id=hosp_a.id,
            status="Active"
        )
        doctor_user.roles.append(role_doctor)

        db_session.add_all([admin_user, hospital_user, doctor_user, auditor_user])
        await db_session.flush()

    return {
        "hospitals": {"A": hosp_a, "B": hosp_b},
        "users": {"admin": admin_user, "hospital": hospital_user, "doctor": doctor_user, "auditor": auditor_user}
    }

@pytest_asyncio.fixture
async def doctor_token_headers(client: AsyncClient, seed_data) -> dict:
    """Helper fixture yielding Bearer Authorization headers for a authenticated Doctor."""
    login_res = await client.post("/api/auth/login", json={
        "username_or_email": "doctor@organmatch.in",
        "password": TEST_AUTH_SECRET
    })
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

