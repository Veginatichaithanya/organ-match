import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, JSONType

class Recipient(Base):
    __tablename__ = "recipients"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    recipient_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    blood_group: Mapped[str] = mapped_column(String(10), nullable=False)
    required_organ: Mapped[str] = mapped_column(
        String(20), nullable=False # "HEART" | "LUNG" | "KIDNEY" | "PANCREAS"
    )
    medical_details: Mapped[dict] = mapped_column(JSONType, default=dict, nullable=False)
    hla_information: Mapped[dict] = mapped_column(JSONType, default=dict, nullable=False)
    priority: Mapped[str] = mapped_column(
        String(20), default="MEDIUM", nullable=False # "HIGH" | "MEDIUM" | "LOW"
    )
    urgency: Mapped[str] = mapped_column(
        String(20), default="MODERATE", nullable=False # "CRITICAL" | "HIGH" | "MODERATE" | "LOW"
    )
    status: Mapped[str] = mapped_column(
        String(20), default="ACTIVE", nullable=False # "ACTIVE" | "INACTIVE" | "ARCHIVED"
    )
    created_by: Mapped[uuid.UUID] = mapped_column(nullable=False)
    updated_by: Mapped[uuid.UUID] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    hospital: Mapped["Hospital"] = relationship("Hospital", back_populates="recipients")
    matches: Mapped[List["Match"]] = relationship("Match", back_populates="recipient", cascade="all, delete-orphan")
    allocations: Mapped[List["Allocation"]] = relationship("Allocation", back_populates="recipient", cascade="all, delete-orphan")
