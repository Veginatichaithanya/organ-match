import uuid
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

class MatchRunRequest(BaseModel):
    organ_id: uuid.UUID = Field(..., description="ID of the available organ to evaluate matching for")

class MatchComponentBreakdown(BaseModel):
    blood: int = Field(..., description="Score component for blood compatibility")
    medical: int = Field(..., description="Score component for medical suitability")
    tissue: int = Field(..., description="Score component for HLA tissue matching")
    priority: int = Field(..., description="Score component for recipient waitlist priority")

    class Config:
        from_attributes = True

class MatchRecipientSummary(BaseModel):
    id: uuid.UUID
    recipient_code: str
    name: Optional[str] = None
    age: int
    blood_group: str
    urgency: str
    priority: str

    class Config:
        from_attributes = True

class MatchResultResponse(BaseModel):
    id: uuid.UUID
    organ_id: uuid.UUID
    recipient_id: uuid.UUID
    compatibility_score: float
    scoring_breakdown: MatchComponentBreakdown
    rank: int
    status: str
    ineligibility_reason: Optional[str] = None
    recipient: Optional[MatchRecipientSummary] = None

    class Config:
        from_attributes = True
