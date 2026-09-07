import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database.session import get_db
from app.models.user import User, Role
from app.security.authentication import get_current_user
from app.services.authorization_service import AuthorizationService

router = APIRouter(prefix="/users", tags=["Users"])

class UserStatusUpdate(BaseModel):
    status: str

@router.get("/")
async def list_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all system users (requires ADMIN role or MANAGE_USERS permission).
    """
    AuthorizationService.authorize(
        user=current_user,
        permission_name="MANAGE_USERS",
        resource_type="User",
        operation="READ"
    )

    query = select(User).options(
        selectinload(User.roles),
        selectinload(User.hospital)
    )
    res = await db.execute(query)
    users = res.scalars().all()

    items = [
        {
            "id": str(u.id),
            "name": u.username,
            "email": u.email,
            "role": u.roles[0].name.lower() if u.roles else "user",
            "organization": u.hospital.name if u.hospital else "Central Authority",
            "status": "Active" if u.status == "Active" else "Suspended",
            "lastLogin": u.created_at.isoformat() if u.created_at else ""
        }
        for u in users
    ]

    return {
        "items": items,
        "total": len(items),
        "page": 1,
        "pageSize": 50
    }

@router.put("/{id}/status")
async def update_user_status(
    id: uuid.UUID,
    payload: UserStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a user's active/suspended status.
    """
    AuthorizationService.authorize(
        user=current_user,
        permission_name="MANAGE_USERS",
        resource_type="User",
        operation="UPDATE"
    )

    user = await db.get(User, id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    user.status = "Active" if payload.status.lower() in ["active", "true"] else "Suspended"
    await db.commit()
    await db.refresh(user)

    return {
        "id": str(user.id),
        "name": user.username,
        "email": user.email,
        "role": user.roles[0].name.lower() if user.roles else "user",
        "organization": user.hospital.name if user.hospital else "Central Authority",
        "status": user.status,
        "lastLogin": user.created_at.isoformat() if user.created_at else ""
    }
