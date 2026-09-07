import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class BlockchainTransaction(Base):
    __tablename__ = "blockchain_transactions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    fabric_tx_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    record_id: Mapped[uuid.UUID] = mapped_column(nullable=False, index=True)
    record_type: Mapped[str] = mapped_column(String(50), nullable=False) # e.g. "Donor", "Recipient", "Allocation"
    operation: Mapped[str] = mapped_column(String(50), nullable=False) # e.g. "RegisterDonor", "ApproveAllocation"
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    channel: Mapped[str] = mapped_column(String(50), nullable=False)
    chaincode: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="PENDING", nullable=False # "PENDING" | "CONFIRMED" | "FAILED"
    )
    created_by: Mapped[uuid.UUID] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
