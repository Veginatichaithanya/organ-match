import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class Allocation(Base):
    __tablename__ = "allocations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    match_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("matches.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    organ_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organs.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("recipients.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(30), default="PENDING", nullable=False
        # "PENDING" | "DATABASE_COMMITTED" | "FABRIC_SUBMITTED" | "FABRIC_CONFIRMED" | "FABRIC_FAILED"
    )
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    rejection_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    fabric_tx_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    created_by: Mapped[uuid.UUID] = mapped_column(nullable=False)
    updated_by: Mapped[uuid.UUID] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    match: Mapped["Match"] = relationship("Match", back_populates="allocation")
    organ: Mapped["Organ"] = relationship("Organ", back_populates="allocations")
    recipient: Mapped["Recipient"] = relationship("Recipient", back_populates="allocations")
    approver: Mapped[Optional["User"]] = relationship("User")

    # Helper properties for related fields
    @property
    def donor_id(self) -> Optional[uuid.UUID]:
        return self.organ.donor_id if self.organ else None

    @property
    def donor_name(self) -> Optional[str]:
        return self.organ.donor.name if self.organ and self.organ.donor else None

    @property
    def donor_code(self) -> Optional[str]:
        return self.organ.donor.donor_code if self.organ and self.organ.donor else None

    @property
    def recipient_name(self) -> Optional[str]:
        return self.recipient.name if self.recipient else None

    @property
    def recipient_code(self) -> Optional[str]:
        return self.recipient.recipient_code if self.recipient else None

    @property
    def organ_type(self) -> Optional[str]:
        return self.organ.organ_type if self.organ else None

    @property
    def organ_code(self) -> Optional[str]:
        return self.organ.organ_code if self.organ else None

    @property
    def match_score(self) -> Optional[float]:
        return self.match.compatibility_score if self.match else None

    @property
    def compatibility_score(self) -> Optional[float]:
        return self.match.compatibility_score if self.match else None

    @property
    def compatibility_score_pct(self) -> Optional[int]:
        if not self.match or self.match.compatibility_score is None:
            return None
        s = self.match.compatibility_score
        return round(s * 100) if s <= 1.0 else round(s)

    @property
    def priority(self) -> Optional[str]:
        return self.recipient.priority if self.recipient else None

    @property
    def decision_maker(self) -> Optional[str]:
        if not self.approver:
            return None
        return self.approver.full_name or self.approver.username

    @property
    def approved_by_name(self) -> Optional[str]:
        if not self.approver:
            return None
        return self.approver.full_name or self.approver.username
