import uuid
from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response, Cookie, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database.session import get_db
from app.models.user import User, Role
from app.schemas.auth import (
    LoginRequest, LoginResponse, UserMeResponse, UserSessionProfile,
    RefreshTokenResponse
)
from app.security.authentication import (
    verify_password, create_access_token, create_refresh_token,
    verify_refresh_token, get_current_user
)
from app.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Role key mapping: backend DB role names -> frontend-friendly role identifiers
ROLE_MAP = {
    "ADMIN": "admin",
    "HOSPITAL_COORDINATOR": "hospital",
    "DOCTOR": "doctor",
    "ALLOCATION_AUTHORITY": "transplant_center",
    "AUDITOR": "auditor"
}

def _build_user_profile(user: User) -> UserSessionProfile:
    """Construct a UserSessionProfile from a User model with preloaded relationships."""
    db_role = user.roles[0].name if user.roles else "AUDITOR"
    role_name = ROLE_MAP.get(db_role, "auditor")

    permissions = list({p.name for r in user.roles for p in r.permissions})

    return UserSessionProfile(
        id=user.id,
        username=user.username,
        email=user.email,
        role=role_name,
        hospital_id=user.hospital_id,
        hospital_name=user.hospital.name if user.hospital else None,
        permissions=permissions
    )

def _set_refresh_cookie(response: Response, refresh_token: str):
    """Utility to set HttpOnly refresh token cookie on response."""
    is_prod = settings.APP_ENV.lower() == "production"
    is_secure = settings.COOKIE_SECURE if settings.COOKIE_SECURE is not None else is_prod
    samesite_val = getattr(settings, "COOKIE_SAMESITE", "lax")

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_secure,
        samesite=samesite_val,
        path="/api/auth",
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    )

@router.post("/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticate user by username or email. Returns JWT access token in JSON body
    and sets HttpOnly cookie for refresh token.
    """
    query = (
        select(User)
        .where((User.username == payload.username_or_email) | (User.email == payload.username_or_email))
        .options(
            selectinload(User.hospital),
            selectinload(User.roles).selectinload(Role.permissions)
        )
    )
    result = await db.execute(query)
    user = result.scalars().first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.status == "Suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended. Access denied."
        )

    db_role = user.roles[0].name if user.roles else "AUDITOR"
    permissions = list({p.name for r in user.roles for p in r.permissions})

    token_data = {
        "sub": str(user.id),
        "role": db_role,
        "hospital_id": str(user.hospital_id) if user.hospital_id else None,
        "permissions": permissions
    }

    expires_in_minutes = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    access_token = create_access_token(
        data=token_data,
        expires_delta=timedelta(minutes=expires_in_minutes)
    )
    refresh_token = create_refresh_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    )

    _set_refresh_cookie(response, refresh_token)
    user_profile = _build_user_profile(user)

    return LoginResponse(
        access_token=access_token,
        expires_in=expires_in_minutes * 60,
        user=user_profile
    )

@router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh_token(
    response: Response,
    refresh_token: Optional[str] = Cookie(None, alias="refresh_token"),
    db: AsyncSession = Depends(get_db)
):
    """
    Exchange HttpOnly refresh token cookie for a new access token (and rotated refresh cookie).
    """
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token cookie missing. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = verify_refresh_token(refresh_token)
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is invalid or expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject payload.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    query = (
        select(User)
        .where(User.id == user_id)
        .options(
            selectinload(User.hospital),
            selectinload(User.roles).selectinload(Role.permissions)
        )
    )
    result = await db.execute(query)
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.status == "Suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended. Access denied."
        )

    db_role = user.roles[0].name if user.roles else "AUDITOR"
    permissions = list({p.name for r in user.roles for p in r.permissions})

    token_data = {
        "sub": str(user.id),
        "role": db_role,
        "hospital_id": str(user.hospital_id) if user.hospital_id else None,
        "permissions": permissions
    }

    expires_in_minutes = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    new_access_token = create_access_token(
        data=token_data,
        expires_delta=timedelta(minutes=expires_in_minutes)
    )
    new_refresh_token = create_refresh_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    )

    _set_refresh_cookie(response, new_refresh_token)

    return RefreshTokenResponse(
        access_token=new_access_token,
        expires_in=expires_in_minutes * 60
    )

@router.post("/logout")
async def logout(response: Response):
    """
    Logout user by clearing HttpOnly refresh cookie.
    """
    is_prod = settings.APP_ENV.lower() == "production"
    is_secure = settings.COOKIE_SECURE if settings.COOKIE_SECURE is not None else is_prod
    samesite_val = getattr(settings, "COOKIE_SAMESITE", "lax")

    response.delete_cookie(
        key="refresh_token",
        path="/api/auth",
        httponly=True,
        secure=is_secure,
        samesite=samesite_val,
    )
    response.delete_cookie(
        key="refresh_token",
        path="/",
        httponly=True,
        secure=is_secure,
        samesite=samesite_val,
    )
    return {"message": "Successfully logged out."}

@router.get("/me", response_model=UserMeResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Get profile information of the currently authenticated user.
    """
    user_profile = _build_user_profile(current_user)
    return UserMeResponse(user=user_profile)
