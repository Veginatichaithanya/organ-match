import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, JSONType

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    username: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    organization: Mapped[str] = mapped_column(String(100), nullable=False)
    operation: Mapped[str] = mapped_column(String(50), nullable=False) # e.g., "CREATE", "UPDATE", "DELETE", "GET /api/..."
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False) # e.g., "Donor", "Recipient", "Organ", "API_Route"
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(nullable=True, index=True)
    old_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONType, nullable=True)
    new_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONType, nullable=True)
    result: Mapped[str] = mapped_column(String(20), nullable=False) # "ALLOW" | "DENIED" | "SUCCESS" | "FAILED"
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False, default="127.0.0.1")
    user_agent: Mapped[str] = mapped_column(String(255), nullable=False, default="Unknown")
    fabric_tx_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[user_id])

    @property
    def timestamp(self) -> datetime:
        return self.created_at
