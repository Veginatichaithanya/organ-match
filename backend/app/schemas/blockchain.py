import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class BlockchainTransactionResponse(BaseModel):
    id: uuid.UUID
    fabric_tx_id: str
    record_id: uuid.UUID
    record_type: str
    operation: str
    payload_hash: str
    channel: str
    chaincode: str
    status: str
    created_by: uuid.UUID
    created_at: datetime
    confirmed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class IntegrityVerificationResponse(BaseModel):
    entity_type: str
    entity_id: str
    status: str # "VALID" | "TAMPERED" | "SUSPICIOUS" | "ERROR"
    reason: str
