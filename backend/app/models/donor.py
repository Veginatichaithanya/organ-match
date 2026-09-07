import uuid
from datetime import datetime, date
from typing import Optional, List
from sqlalchemy import String, Integer, DateTime, Date, Boolean, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, JSONType

class Donor(Base):
    __tablename__ = "donors"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    donor_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    gender: Mapped[str] = mapped_column(String(20), default="Not specified", nullable=False)
    contact_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    residential_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    blood_group: Mapped[str] = mapped_column(String(50), default="Unknown", nullable=False)
    donation_preferences: Mapped[dict] = mapped_column(JSONType, default=dict, nullable=False)
    declaration_acknowledged: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    registration_date: Mapped[Optional[date]] = mapped_column(Date, default=date.today, nullable=True)
    hla_information: Mapped[dict] = mapped_column(JSONType, default=dict, nullable=False)
    medical_details: Mapped[dict] = mapped_column(JSONType, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="ACTIVE", nullable=False # "ACTIVE" | "INACTIVE" | "ARCHIVED"
    )
    created_by: Mapped[uuid.UUID] = mapped_column(nullable=False)
    updated_by: Mapped[uuid.UUID] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    hospital: Mapped["Hospital"] = relationship("Hospital", back_populates="donors")
    organs: Mapped[List["Organ"]] = relationship("Organ", back_populates="donor", cascade="all, delete-orphan")

