import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


VALID_SUITABILITIES = {"APPROVED", "NOT_APPROVED", "NEEDS_REVIEW"}
VALID_RISK_LEVELS = {"LOW", "MEDIUM", "HIGH"}


class MedicalAssessmentCreate(BaseModel):
    entity_type: str = Field(..., description="Entity type: 'Donor' | 'Recipient' | 'Organ' | 'Match'")
    entity_id: uuid.UUID = Field(..., description="UUID of the entity being assessed")
    suitability: str = Field(
        default="NEEDS_REVIEW",
        description="Clinical suitability decision: APPROVED | NOT_APPROVED | NEEDS_REVIEW | SUITABLE | NOT_SUITABLE | CONDITIONALLY_SUITABLE"
    )
    risk_level: str = Field(
        default="MEDIUM",
        description="Clinical risk level: LOW | MEDIUM | HIGH | MODERATE | CRITICAL"
    )
    clinical_notes: Optional[str] = Field(None, description="Detailed clinical observations")
    recommendation: Optional[str] = Field(None, description="Clinical recommendation text")

    @field_validator("suitability")
    @classmethod
    def normalize_suitability(cls, v: str) -> str:
        s = v.strip().upper().replace(" ", "_")
        if s in {"SUITABLE", "APPROVED", "COMPATIBLE"}:
            return "APPROVED"
        if s in {"NOT_SUITABLE", "NOT_APPROVED", "REJECTED", "INCOMPATIBLE"}:
            return "NOT_APPROVED"
        if s in {"CONDITIONALLY_SUITABLE", "NEEDS_REVIEW", "PENDING", "HOLD", "REVIEW"}:
            return "NEEDS_REVIEW"
        if s in VALID_SUITABILITIES:
            return s
        return "NEEDS_REVIEW"

    @field_validator("risk_level")
    @classmethod
    def normalize_risk_level(cls, v: str) -> str:
        r = v.strip().upper().replace(" ", "_")
        if r in {"LOW", "MINIMAL"}:
            return "LOW"
        if r in {"MEDIUM", "MODERATE"}:
            return "MEDIUM"
        if r in {"HIGH", "CRITICAL", "SEVERE"}:
            return "HIGH"
        if r in VALID_RISK_LEVELS:
            return r
        return "MEDIUM"


class MedicalAssessmentUpdate(BaseModel):
    suitability: Optional[str] = Field(None, description="Updated suitability decision")
    risk_level: Optional[str] = Field(None, description="Updated risk level")
    clinical_notes: Optional[str] = Field(None, description="Updated clinical notes")
    recommendation: Optional[str] = Field(None, description="Updated recommendation")

    @field_validator("suitability")
    @classmethod
    def normalize_suitability_opt(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        s = v.strip().upper().replace(" ", "_")
        if s in {"SUITABLE", "APPROVED", "COMPATIBLE"}:
            return "APPROVED"
        if s in {"NOT_SUITABLE", "NOT_APPROVED", "REJECTED", "INCOMPATIBLE"}:
            return "NOT_APPROVED"
        if s in {"CONDITIONALLY_SUITABLE", "NEEDS_REVIEW", "PENDING", "HOLD", "REVIEW"}:
            return "NEEDS_REVIEW"
        return s if s in VALID_SUITABILITIES else "NEEDS_REVIEW"

    @field_validator("risk_level")
    @classmethod
    def normalize_risk_level_opt(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        r = v.strip().upper().replace(" ", "_")
        if r in {"LOW", "MINIMAL"}:
            return "LOW"
        if r in {"MEDIUM", "MODERATE"}:
            return "MEDIUM"
        if r in {"HIGH", "CRITICAL", "SEVERE"}:
            return "HIGH"
        return r if r in VALID_RISK_LEVELS else "MEDIUM"


class MatchReviewRequest(BaseModel):
    suitability: str = Field(
        default="APPROVED",
        description="Clinical suitability decision: APPROVED | NOT_APPROVED | NEEDS_REVIEW"
    )
    risk_level: str = Field(
        default="LOW",
        description="Clinical risk level: LOW | MEDIUM | HIGH"
    )
    recommendation: str = Field(
        default="RECOMMEND_FOR_ALLOCATION",
        description="Clinical recommendation: RECOMMEND_FOR_ALLOCATION | HOLD_FOR_FURTHER_REVIEW | CLINICALLY_UNSUITABLE"
    )
    clinical_notes: Optional[str] = Field(None, description="Detailed clinical notes and rationale")
    rejection_reason: Optional[str] = Field(None, description="Reason if marked clinically unsuitable")


class MedicalAssessmentResponse(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    suitability: str
    risk_level: str
    clinical_notes: Optional[str]
    recommendation: Optional[str]
    reviewed_by: uuid.UUID
    reviewed_at: datetime
    created_at: datetime
    updated_at: datetime
    reviewer_username: Optional[str] = None
    target_code: Optional[str] = None
    target_name: Optional[str] = None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }


class DoctorOverviewResponse(BaseModel):
    hospital_id: Optional[uuid.UUID] = None
    hospital_name: str
    donors_pending_review: int
    recipients_pending_review: int
    organs_available: int
    matches_pending: int
    total_assessments_by_me: int
    recent_assessments: List[dict] = []
    priority_reviews: List[dict] = []

