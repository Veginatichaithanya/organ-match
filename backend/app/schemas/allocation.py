import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class AllocationCreate(BaseModel):
    match_id: uuid.UUID = Field(..., description="ID of the compatibility match to trigger allocation for")

class AllocationDecisionRequest(BaseModel):
    rejection_reason: Optional[str] = Field(None, max_length=255, description="Reason for rejection, required if rejecting")

class AllocationResponse(BaseModel):
    id: uuid.UUID
    match_id: uuid.UUID
    organ_id: uuid.UUID
    recipient_id: uuid.UUID
    status: str
    approved_by: Optional[uuid.UUID] = None
    rejection_reason: Optional[str] = None
    fabric_tx_id: Optional[str] = None
    created_by: uuid.UUID
    updated_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    # Related fields
    donor_id: Optional[uuid.UUID] = None
    donor_name: Optional[str] = None
    donor_code: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_code: Optional[str] = None
    organ_type: Optional[str] = None
    organ_code: Optional[str] = None
    match_score: Optional[float] = None
    compatibility_score: Optional[float] = None
    compatibility_score_pct: Optional[int] = None
    priority: Optional[str] = None
    decision_maker: Optional[str] = None
    approved_by_name: Optional[str] = None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }
