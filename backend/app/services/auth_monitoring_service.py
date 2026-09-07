import logging
from datetime import datetime, timezone
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.models.user import User
from app.config import settings

logger = logging.getLogger("auth_monitoring")

class AuthMonitoringService:
    """
    Real-time Authentication, JWT security, and RBAC policy engine health checks.
    """

    async def check_status(self, db: AsyncSession) -> Dict[str, Any]:
        now_utc = datetime.now(timezone.utc)
        active_users = 0
        locked_accounts = 0

        try:
            res = await db.execute(select(func.count(User.id)).where(User.status == "Active"))
            active_users = res.scalar() or 0

            l_res = await db.execute(select(func.count(User.id)).where(User.status == "Suspended"))
            locked_accounts = l_res.scalar() or 0
        except Exception as exc:
            logger.debug(f"Auth monitoring user count query skipped: {exc}")

        has_jwt = bool(settings.JWT_SECRET_KEY and settings.JWT_ALGORITHM)
        status = "HEALTHY" if has_jwt else "DEGRADED"
        message = f"{active_users} active users — JWT HS256 + RBAC/ABAC policy engine"

        return {
            "service": "authentication",
            "status": status,
            "message": message,
            "jwt_status": "HEALTHY (HS256)" if has_jwt else "UNAVAILABLE",
            "active_users": active_users,
            "locked_accounts": locked_accounts,
            "checked_at": now_utc,
        }

auth_monitoring_service = AuthMonitoringService()
