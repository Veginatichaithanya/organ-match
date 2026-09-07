import uuid
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr


# ─── User Management ──────────────────────────────────────────────────────────

class UserCreateRequest(BaseModel):
    username: str
    full_name: Optional[str] = None
    email: EmailStr
    hospital_id: Optional[uuid.UUID] = None
    role_name: str
    password: str


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    hospital_id: Optional[uuid.UUID] = None


class RoleInfo(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class UserDetailResponse(BaseModel):
    id: uuid.UUID
    username: str
    full_name: Optional[str] = None
    email: str
    status: str
    must_change_password: bool
    hospital_id: Optional[uuid.UUID] = None
    hospital_name: Optional[str] = None
    roles: List[RoleInfo]
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserListItem(BaseModel):
    id: uuid.UUID
    username: str
    full_name: Optional[str] = None
    email: str
    status: str
    must_change_password: bool
    hospital_id: Optional[uuid.UUID] = None
    hospital_name: Optional[str] = None
    role: Optional[str] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ResetPasswordRequest(BaseModel):
    new_password: Optional[str] = None


class ResetPasswordResponse(BaseModel):
    user_id: uuid.UUID
    username: str
    temporary_password: Optional[str] = None
    message: str


class AdminChangePasswordRequest(BaseModel):
    new_password: str


# ─── Role & Permission Management ────────────────────────────────────────────

class RoleAssignRequest(BaseModel):
    role_name: str


class PermissionInfo(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class RoleWithPermissionsResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    permissions: List[PermissionInfo]

    class Config:
        from_attributes = True


# ─── Hospital Management ─────────────────────────────────────────────────────

class HospitalCreateRequest(BaseModel):
    name: str
    code: Optional[str] = None
    location: str
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None


class HospitalUpdateRequest(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    location: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None


class HospitalStatusUpdate(BaseModel):
    status: str  # "Active" | "Suspended"


class HospitalDetailResponse(BaseModel):
    id: uuid.UUID
    name: str
    code: Optional[str] = None
    location: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    status: str
    user_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Admin Overview ───────────────────────────────────────────────────────────

class AdminOverviewResponse(BaseModel):
    total_users: int
    active_users: int
    inactive_users: int
    total_hospitals: int
    active_hospitals: int
    total_security_events: int
    open_tampering_alerts: int
    total_blockchain_transactions: int
    recent_security_events: int  # last 24h


# ─── System Settings ─────────────────────────────────────────────────────────

class SystemSettingsResponse(BaseModel):
    max_failed_login_attempts: int
    account_lock_duration_minutes: int
    access_token_expire_minutes: int
    refresh_token_expire_days: int
    matching_algorithm_version: str
    app_env: str
    audit_retention_days: int
    security_monitoring_enabled: bool
