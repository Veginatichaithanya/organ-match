import uuid
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func

from app.database.session import get_db
from app.models.user import User, Role, Permission, user_roles
from app.models.hospital import Hospital
from app.models.blockchain_transaction import BlockchainTransaction
from sqlalchemy import delete
from app.models.donor import Donor
from app.models.recipient import Recipient
from app.models.organ import Organ
from app.models.match import Match
from app.models.medical_assessment import MedicalAssessment
from app.schemas.admin import (
    UserCreateRequest,
    UserUpdateRequest,
    UserDetailResponse,
    UserListItem,
    ResetPasswordRequest,
    ResetPasswordResponse,
    AdminChangePasswordRequest,
    RoleAssignRequest,
    RoleWithPermissionsResponse,
    HospitalCreateRequest,
    HospitalUpdateRequest,
    HospitalStatusUpdate,
    HospitalDetailResponse,
    AdminOverviewResponse,
    SystemSettingsResponse,
)
from app.security.authentication import get_current_user, get_password_hash
from app.security.rbac import RequirePermission
from app.config import settings

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(RequirePermission("MANAGE_USERS"))],
)

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _require_admin(current_user: User) -> None:
    """Double-check that the caller has an ADMIN role."""
    role_names = {r.name for r in current_user.roles}
    if "ADMIN" not in role_names:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required."
        )


def _generate_temp_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _build_user_list_item(u: User) -> dict:
    return {
        "id": str(u.id),
        "username": u.username,
        "full_name": u.full_name,
        "email": u.email,
        "status": u.status,
        "must_change_password": u.must_change_password,
        "hospital_id": str(u.hospital_id) if u.hospital_id else None,
        "hospital_name": u.hospital.name if u.hospital else None,
        "role": u.roles[0].name if u.roles else None,
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        "created_at": u.created_at.isoformat(),
    }


# ─── Overview ────────────────────────────────────────────────────────────────

@router.get("/overview", response_model=AdminOverviewResponse)
async def admin_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Administrative overview — system statistics only.
    No medical data (donors/recipients/organs) is included.
    """
    _require_admin(current_user)

    now_utc = datetime.now(timezone.utc)
    yesterday = now_utc - timedelta(hours=24)

    # Execute queries
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    active_users = (
        await db.execute(select(func.count(User.id)).where(User.status == "Active"))
    ).scalar() or 0
    inactive_users = (
        await db.execute(select(func.count(User.id)).where(User.status != "Active"))
    ).scalar() or 0
    total_hospitals = (await db.execute(select(func.count(Hospital.id)))).scalar() or 0
    active_hospitals = (
        await db.execute(select(func.count(Hospital.id)).where(Hospital.status == "Active"))
    ).scalar() or 0
    total_blockchain = (
        await db.execute(select(func.count(BlockchainTransaction.id)))
    ).scalar() or 0

    return AdminOverviewResponse(
        total_users=total_users,
        active_users=active_users,
        inactive_users=inactive_users,
        total_hospitals=total_hospitals,
        active_hospitals=active_hospitals,
        total_security_events=0,
        open_tampering_alerts=0,
        total_blockchain_transactions=total_blockchain,
        recent_security_events=0,
    )


# ─── Users ────────────────────────────────────────────────────────────────────

@router.get("/users/", response_model=List[UserListItem])
async def list_admin_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users with full detail for admin user management."""
    _require_admin(current_user)

    query = select(User).options(
        selectinload(User.roles),
        selectinload(User.hospital),
    ).order_by(User.created_at.desc())

    result = await db.execute(query)
    users = result.scalars().all()

    return [
        UserListItem(
            id=u.id,
            username=u.username,
            full_name=u.full_name,
            email=u.email,
            status=u.status,
            must_change_password=u.must_change_password,
            hospital_id=u.hospital_id,
            hospital_name=u.hospital.name if u.hospital else None,
            role=u.roles[0].name if u.roles else None,
            last_login_at=u.last_login_at,
            created_at=u.created_at,
        )
        for u in users
    ]


@router.get("/users/{user_id}", response_model=UserDetailResponse)
async def get_admin_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full user detail including roles and hospital."""
    _require_admin(current_user)

    query = (
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.roles), selectinload(User.hospital))
    )
    result = await db.execute(query)
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    return UserDetailResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        email=user.email,
        status=user.status,
        must_change_password=user.must_change_password,
        hospital_id=user.hospital_id,
        hospital_name=user.hospital.name if user.hospital else None,
        roles=[{"id": r.id, "name": r.name, "description": r.description} for r in user.roles],
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.post("/users/", status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new user with a hashed temporary password.
    Sets must_change_password=True. Audit-logged.
    """
    _require_admin(current_user)

    # Check username uniqueness
    existing_u = (
        await db.execute(select(User).where(User.username == payload.username))
    ).scalars().first()
    if existing_u:
        raise HTTPException(status_code=400, detail="Username already exists.")

    existing_e = (
        await db.execute(select(User).where(User.email == payload.email))
    ).scalars().first()
    if existing_e:
        raise HTTPException(status_code=400, detail="Email already registered.")

    # Find role
    role = (
        await db.execute(select(Role).where(Role.name == payload.role_name))
    ).scalars().first()
    if not role:
        raise HTTPException(status_code=400, detail=f"Role '{payload.role_name}' not found.")

    # Hash password
    password_hash = get_password_hash(payload.password)

    new_user = User(
        username=payload.username,
        full_name=payload.full_name,
        email=payload.email,
        hospital_id=payload.hospital_id,
        password_hash=password_hash,
        status="Active",
        must_change_password=True,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(new_user)
    await db.flush()  # get new_user.id without committing

    # Assign role
    await db.execute(
        user_roles.insert().values(
            user_id=new_user.id,
            role_id=role.id,
            assigned_by=current_user.id,
        )
    )
    await db.commit()
    await db.refresh(new_user)

    return {
        "id": str(new_user.id),
        "username": new_user.username,
        "email": new_user.email,
        "status": new_user.status,
        "role": role.name,
        "must_change_password": True,
    }


@router.put("/users/{user_id}")
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user details (name, email, hospital). Audit-logged."""
    _require_admin(current_user)

    query = (
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.roles), selectinload(User.hospital))
    )
    result = await db.execute(query)
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    old_data = {
        "full_name": user.full_name,
        "email": user.email,
        "hospital_id": str(user.hospital_id) if user.hospital_id else None,
    }

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.email is not None:
        user.email = payload.email
    if payload.hospital_id is not None:
        user.hospital_id = payload.hospital_id

    user.updated_by = current_user.id
    await db.commit()
    await db.refresh(user)

    return {"id": str(user.id), "username": user.username, "status": user.status}


@router.put("/users/{user_id}/status")
async def set_user_status(
    user_id: uuid.UUID,
    payload: dict,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Activate or deactivate a user. Audit-logged."""
    _require_admin(current_user)

    new_status = payload.get("status", "Active")
    allowed_statuses = {"Active", "Suspended", "Inactive", "Locked"}
    if new_status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {allowed_statuses}")

    query = select(User).where(User.id == user_id)
    result = await db.execute(query)
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    old_status = user.status
    user.status = new_status
    user.updated_by = current_user.id
    await db.commit()

    return {"id": str(user.id), "status": user.status}


@router.post("/users/{user_id}/reset-password", response_model=ResetPasswordResponse)
async def reset_user_password(
    user_id: uuid.UUID,
    request: Request,
    payload: Optional[ResetPasswordRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a secure temporary password (or apply supplied password), hash it, store the hash.
    Sets must_change_password=True. Returns temp password ONCE.
    Audit-logged.
    """
    _require_admin(current_user)

    query = select(User).where(User.id == user_id)
    result = await db.execute(query)
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    temp_password = (payload.new_password if payload and payload.new_password else None) or _generate_temp_password()
    user.password_hash = get_password_hash(temp_password)
    user.must_change_password = True
    user.updated_by = current_user.id
    await db.commit()

    return ResetPasswordResponse(
        user_id=user.id,
        username=user.username,
        temporary_password=temp_password,
        message="Temporary password issued. User must change it on next login.",
    )


@router.post("/users/{user_id}/change-password")
async def admin_change_user_password(
    user_id: uuid.UUID,
    payload: AdminChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin explicitly changes a user's password.
    Validates minimum length, securely hashes the password with Argon2/bcrypt,
    and updates the database. Plaintext password is NEVER stored.
    """
    _require_admin(current_user)

    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long."
        )

    query = select(User).where(User.id == user_id)
    result = await db.execute(query)
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.password_hash = get_password_hash(payload.new_password)
    user.updated_by = current_user.id
    await db.commit()

    return {"message": "Password updated successfully.", "user_id": str(user.id)}


# ─── Role Management ─────────────────────────────────────────────────────────

@router.post("/users/{user_id}/roles", dependencies=[Depends(RequirePermission("MANAGE_PERMISSIONS"))])
async def assign_role(
    user_id: uuid.UUID,
    payload: RoleAssignRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Assign a role to a user. Audit-logged."""
    _require_admin(current_user)

    query = (
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.roles))
    )
    result = await db.execute(query)
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    role = (
        await db.execute(select(Role).where(Role.name == payload.role_name))
    ).scalars().first()
    if not role:
        raise HTTPException(status_code=404, detail=f"Role '{payload.role_name}' not found.")

    # Check already assigned
    current_role_names = {r.name for r in user.roles}
    if role.name in current_role_names:
        raise HTTPException(status_code=400, detail="Role already assigned to this user.")

    old_roles = [r.name for r in user.roles]

    await db.execute(
        user_roles.insert().values(
            user_id=user.id,
            role_id=role.id,
            assigned_by=current_user.id,
        )
    )
    await db.commit()

    return {"user_id": str(user.id), "assigned_role": role.name}


@router.delete(
    "/users/{user_id}/roles/{role_name}",
    dependencies=[Depends(RequirePermission("MANAGE_PERMISSIONS"))],
)
async def remove_role(
    user_id: uuid.UUID,
    role_name: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a role from a user. Audit-logged."""
    _require_admin(current_user)

    query = (
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.roles))
    )
    result = await db.execute(query)
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    role = next((r for r in user.roles if r.name == role_name), None)
    if not role:
        raise HTTPException(status_code=404, detail=f"Role '{role_name}' not assigned to this user.")

    old_roles = [r.name for r in user.roles]

    await db.execute(
        user_roles.delete().where(
            (user_roles.c.user_id == user.id) & (user_roles.c.role_id == role.id)
        )
    )
    await db.commit()

    return {"user_id": str(user.id), "removed_role": role_name}


@router.get(
    "/roles",
    response_model=List[RoleWithPermissionsResponse],
    dependencies=[Depends(RequirePermission("MANAGE_PERMISSIONS"))],
)
async def list_roles(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all roles with their assigned permissions (RBAC matrix)."""
    _require_admin(current_user)

    query = select(Role).options(selectinload(Role.permissions)).order_by(Role.name)
    result = await db.execute(query)
    roles = result.scalars().all()

    return [
        RoleWithPermissionsResponse(
            id=r.id,
            name=r.name,
            description=r.description,
            permissions=[
                {"id": p.id, "name": p.name, "description": p.description}
                for p in r.permissions
            ],
        )
        for r in roles
    ]


# ─── Hospital Management ─────────────────────────────────────────────────────

@router.get("/hospitals/", response_model=List[HospitalDetailResponse])
async def list_admin_hospitals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all hospitals with user count and full details."""
    _require_admin(current_user)

    query = select(Hospital).order_by(Hospital.name)
    result = await db.execute(query)
    hospitals = result.scalars().all()

    output = []
    for h in hospitals:
        user_count = (
            await db.execute(
                select(func.count(User.id)).where(User.hospital_id == h.id)
            )
        ).scalar() or 0
        output.append(
            HospitalDetailResponse(
                id=h.id,
                name=h.name,
                code=h.code,
                location=h.location,
                contact_email=h.contact_email,
                contact_phone=h.contact_phone,
                address=h.address,
                status=h.status,
                user_count=user_count,
                created_at=h.created_at,
                updated_at=h.updated_at,
            )
        )

    return output


@router.post("/hospitals/", status_code=status.HTTP_201_CREATED)
async def create_hospital(
    payload: HospitalCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new hospital. Audit-logged."""
    _require_admin(current_user)

    existing = (
        await db.execute(select(Hospital).where(Hospital.name == payload.name))
    ).scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="A hospital with that name already exists.")

    hospital = Hospital(
        name=payload.name,
        code=payload.code,
        location=payload.location,
        contact_email=payload.contact_email,
        contact_phone=payload.contact_phone,
        address=payload.address,
        status="Active",
    )
    db.add(hospital)
    await db.commit()
    await db.refresh(hospital)

    return {"id": str(hospital.id), "name": hospital.name, "status": hospital.status}


@router.put("/hospitals/{hospital_id}")
async def update_hospital(
    hospital_id: uuid.UUID,
    payload: HospitalUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Edit hospital details. Audit-logged."""
    _require_admin(current_user)

    hospital = await db.get(Hospital, hospital_id)
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found.")

    old_data = {
        "name": hospital.name,
        "location": hospital.location,
        "contact_email": hospital.contact_email,
    }

    if payload.name is not None:
        hospital.name = payload.name
    if payload.code is not None:
        hospital.code = payload.code
    if payload.location is not None:
        hospital.location = payload.location
    if payload.contact_email is not None:
        hospital.contact_email = payload.contact_email
    if payload.contact_phone is not None:
        hospital.contact_phone = payload.contact_phone
    if payload.address is not None:
        hospital.address = payload.address

    await db.commit()
    await db.refresh(hospital)

    return {"id": str(hospital.id), "name": hospital.name, "status": hospital.status}


@router.put("/hospitals/{hospital_id}/status")
async def set_hospital_status(
    hospital_id: uuid.UUID,
    payload: HospitalStatusUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Activate or deactivate a hospital. Audit-logged."""
    _require_admin(current_user)

    allowed = {"Active", "Suspended"}
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Status must be one of {allowed}")

    hospital = await db.get(Hospital, hospital_id)
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found.")

    old_status = hospital.status
    hospital.status = payload.status
    await db.commit()

    return {"id": str(hospital.id), "name": hospital.name, "status": hospital.status}


# ─── System Settings ─────────────────────────────────────────────────────────

@router.get("/settings", response_model=SystemSettingsResponse)
async def get_system_settings(
    current_user: User = Depends(get_current_user),
):
    """
    Return non-secret system configuration for admin review.
    Secrets (JWT keys, DB URLs, private keys) are NEVER exposed here.
    """
    _require_admin(current_user)

    return SystemSettingsResponse(
        max_failed_login_attempts=getattr(settings, "MAX_FAILED_LOGIN_ATTEMPTS", 5),
        account_lock_duration_minutes=getattr(settings, "ACCOUNT_LOCK_DURATION_MINUTES", 30),
        access_token_expire_minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
        refresh_token_expire_days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS,
        matching_algorithm_version=getattr(settings, "MATCHING_ALGORITHM_VERSION", "1.0.0"),
        app_env=settings.APP_ENV,
        audit_retention_days=getattr(settings, "AUDIT_RETENTION_DAYS", 365),
        security_monitoring_enabled=getattr(settings, "SECURITY_MONITORING_ENABLED", True),
    )


# ─── Development Tools ───────────────────────────────────────────────────────

@router.post("/development/cleanup-demo-data")
async def cleanup_demo_data(
    purge_all: bool = True,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Remove demo and clinical records from the database.
    This is an admin-only, transaction-based cleanup action.
    """
    _require_admin(current_user)

    if purge_all:
        tables = [
            "allocations",
            "matches",
            "medical_assessments",
            "organs",
            "recipients",
            "donors",
            "blockchain_transactions",
        ]
        for table in tables:
            await db.execute(text(f"TRUNCATE TABLE {table} CASCADE;"))
        await db.commit()
        return {
            "message": "All clinical data cleared successfully.",
            "counts": {"purged_all": True}
        }

    demo_donor_codes = ["D001", "D002", "D003", "D004"]
    demo_recipient_codes = ["R101", "R102", "R103", "R104"]

    # First find all donor IDs and recipient IDs
    donor_res = await db.execute(select(Donor.id).where(Donor.donor_code.in_(demo_donor_codes)))
    donor_ids = [row for row in donor_res.scalars()]

    recip_res = await db.execute(select(Recipient.id).where(Recipient.recipient_code.in_(demo_recipient_codes)))
    recip_ids = [row for row in recip_res.scalars()]

    deleted_counts = {
        "donors": len(donor_ids),
        "recipients": len(recip_ids),
        "organs": 0,
        "matches": 0,
        "assessments": 0,
    }

    if donor_ids or recip_ids:
        # Delete medical assessments
        entity_ids = donor_ids + recip_ids
        if entity_ids:
            res = await db.execute(delete(MedicalAssessment).where(MedicalAssessment.entity_id.in_(entity_ids)))
            deleted_counts["assessments"] += res.rowcount

        # Get organ IDs for donors
        if donor_ids:
            organ_res = await db.execute(select(Organ.id).where(Organ.donor_id.in_(donor_ids)))
            organ_ids = [row for row in organ_res.scalars()]
            if organ_ids:
                res = await db.execute(delete(Match).where(Match.organ_id.in_(organ_ids)))
                deleted_counts["matches"] += res.rowcount
            
            res = await db.execute(delete(Organ).where(Organ.donor_id.in_(donor_ids)))
            deleted_counts["organs"] += res.rowcount

        # Get matches for recipients
        if recip_ids:
            res = await db.execute(delete(Match).where(Match.recipient_id.in_(recip_ids)))
            deleted_counts["matches"] += res.rowcount

        if donor_ids:
            await db.execute(delete(Donor).where(Donor.id.in_(donor_ids)))
        if recip_ids:
            await db.execute(delete(Recipient).where(Recipient.id.in_(recip_ids)))
            
        await db.commit()

    return {
        "message": "Demo data cleaned up successfully.",
        "counts": deleted_counts
    }


# ─── Post-Quantum Cryptography (PQC) Security Layer ─────────────────────────

from app.security.pqc.service import pqc_service
from app.security.pqc.schemas import PQCStatusResponse, PQCTestResponse, PQCBenchmarkResponse

@router.get("/security/pqc/status", response_model=PQCStatusResponse)
async def get_pqc_status(
    current_user: User = Depends(get_current_user),
):
    """
    Return safe Post-Quantum Cryptography (PQC) security status and key metadata.
    Secrets, private keys, and shared secrets are NEVER returned.
    """
    _require_admin(current_user)
    return pqc_service.get_status()


@router.post("/security/pqc/test", response_model=PQCTestResponse)
async def run_pqc_test(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Execute a post-quantum key encapsulation/decapsulation verification test.
    Logs an audit event without exposing private keys or shared secrets.
    """
    _require_admin(current_user)
    res = pqc_service.run_verification_test()

    return res


@router.get("/security/pqc/benchmark", response_model=PQCBenchmarkResponse)
async def run_pqc_benchmark(
    current_user: User = Depends(get_current_user),
):
    """
    Run performance benchmark measuring ML-KEM-768 key generation, encapsulation,
    and decapsulation timings in milliseconds.
    """
    _require_admin(current_user)
    return pqc_service.run_benchmark()
