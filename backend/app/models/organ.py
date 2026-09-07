import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, JSONType

class Organ(Base):
    __tablename__ = "organs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    donor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("donors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    organ_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    organ_type: Mapped[str] = mapped_column(
        String(20), nullable=False # "HEART" | "LUNG" | "KIDNEY" | "PANCREAS" | "LIVER"
    )
    blood_group: Mapped[str] = mapped_column(String(10), nullable=False)
    medical_details: Mapped[dict] = mapped_column(JSONType, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="AVAILABLE", nullable=False # "AVAILABLE" | "RESERVED" | "ALLOCATED" | "TRANSPLANTED" | "EXPIRED" | "DISCARDED"
    )
    ischemic_start_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    max_ischemic_hours: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(nullable=False)
    updated_by: Mapped[uuid.UUID] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    donor: Mapped["Donor"] = relationship("Donor", back_populates="organs")
    matches: Mapped[List["Match"]] = relationship("Match", back_populates="organ", cascade="all, delete-orphan")
    allocations: Mapped[List["Allocation"]] = relationship("Allocation", back_populates="organ", cascade="all, delete-orphan")
