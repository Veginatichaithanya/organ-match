import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class MedicalAssessment(Base):
    """
    Stores clinical review records created by Doctors for Donors,
    Recipients, Organs, or Matches. Separate from raw medical_details JSONB
    to maintain audit isolation and version tracking.
    """
    __tablename__ = "medical_assessments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    # Polymorphic reference — which entity this assessment covers
    entity_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    # 'Donor' | 'Recipient' | 'Organ' | 'Match'
    entity_id: Mapped[uuid.UUID] = mapped_column(nullable=False, index=True)

    # Clinical decision fields
    suitability: Mapped[str] = mapped_column(
        String(20), nullable=False, default="NEEDS_REVIEW"
        # "APPROVED" | "NOT_APPROVED" | "NEEDS_REVIEW"
    )
    risk_level: Mapped[str] = mapped_column(
        String(10), nullable=False, default="MEDIUM"
        # "LOW" | "MEDIUM" | "HIGH"
    )
    clinical_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recommendation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Reviewer identity — FK to users table
    reviewed_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    # Timestamps
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, index=True, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    reviewer: Mapped["User"] = relationship("User", foreign_keys=[reviewed_by])
