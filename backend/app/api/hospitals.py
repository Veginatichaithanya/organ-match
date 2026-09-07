from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.database.session import get_db
from app.models.user import User
from app.models.hospital import Hospital
from app.security.authentication import get_current_user

router = APIRouter(prefix="/hospitals", tags=["Hospitals"])

@router.get("/")
async def list_hospitals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all active hospitals for network management.
    """
    res = await db.execute(select(Hospital))
    hospitals = res.scalars().all()
    
    items = []
    for h in hospitals:
        user_count = (await db.execute(select(func.count(User.id)).where(User.hospital_id == h.id))).scalar() or 0
        items.append({
            "id": str(h.id),
            "name": h.name,
            "organization": h.name,
            "location": h.location,
            "users": user_count,
            "activeRecords": 10,
            "status": h.status if h.status in ["Active", "Suspended"] else "Active"
        })

    return {
        "items": items,
        "total": len(items),
        "page": 1,
        "pageSize": 50
    }
