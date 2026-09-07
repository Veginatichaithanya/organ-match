import uuid
from typing import Optional, List, Any, Dict
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog
from app.models.user import User

class AuditService:
    @staticmethod
    async def log_action(
        db: AsyncSession,
        user: Optional[User] = None,
        operation: str = "UNKNOWN",
        entity_type: str = "GENERAL",
        entity_id: Optional[uuid.UUID] = None,
        old_data: Optional[Dict[str, Any]] = None,
        new_data: Optional[Dict[str, Any]] = None,
        result: str = "ALLOW",
        reason: Optional[str] = None,
        ip_address: str = "127.0.0.1",
        user_agent: str = "Internal Service",
        fabric_tx_id: Optional[str] = None,
    ) -> AuditLog:
        """
        Standard audit logging service that records immutable audit logs in PostgreSQL.
        """
        username = "System"
        role = "SYSTEM"
        org = "Central Authority"

        if user:
            username = user.username or str(user.id)
            if hasattr(user, "roles") and user.roles:
                role = user.roles[0].name
            if hasattr(user, "hospital") and user.hospital:
                org = user.hospital.name

        audit_entry = AuditLog(
            user_id=user.id if user else None,
            username=username,
            role=role,
            organization=org,
            operation=operation,
            entity_type=entity_type,
            entity_id=entity_id,
            old_data=old_data,
            new_data=new_data,
            result=result,
            reason=reason,
            ip_address=ip_address,
            user_agent=user_agent,
            fabric_tx_id=fabric_tx_id,
            created_at=datetime.utcnow()
        )
        db.add(audit_entry)
        await db.commit()
        await db.refresh(audit_entry)
        return audit_entry
