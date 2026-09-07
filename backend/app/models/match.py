import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Float, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, JSONType

class Match(Base):
    __tablename__ = "matches"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organ_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("recipients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    compatibility_score: Mapped[float] = mapped_column(Float, nullable=False)
    scoring_breakdown: Mapped[dict] = mapped_column(JSONType, default=dict, nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="PENDING", nullable=False # "PROPOSED" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED" | "PENDING" | "SELECTED"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organ: Mapped["Organ"] = relationship("Organ", back_populates="matches")
    recipient: Mapped["Recipient"] = relationship("Recipient", back_populates="matches")
    allocation: Mapped[Optional["Allocation"]] = relationship("Allocation", back_populates="match", uselist=False)

    @property
    def ineligibility_reason(self) -> Optional[str]:
        if isinstance(self.scoring_breakdown, dict):
            return self.scoring_breakdown.get("reason")
        return None
