import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator

VALID_BLOOD_GROUPS = {"A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"}
VALID_ORGANS = {"HEART", "LUNG", "KIDNEY", "PANCREAS"}
VALID_PRIORITIES = {"HIGH", "MEDIUM", "LOW"}
VALID_URGENCIES = {"CRITICAL", "HIGH", "MODERATE", "LOW"}

class RecipientBase(BaseModel):
    recipient_code: Optional[str] = Field(None, description="Unique identifier for the recipient (e.g., R001)")
    name: Optional[str] = Field(None, description="Full name of the recipient")
    age: int = Field(..., ge=0, le=120)
    blood_group: str = Field(..., description="Blood group (e.g., O+, A-, AB+)")
    required_organ: str = Field(..., description="Organ type required: HEART, LUNG, KIDNEY, PANCREAS")
    medical_details: Optional[Dict[str, Any]] = Field(default_factory=dict)
    hla_information: Optional[Dict[str, Any]] = Field(default_factory=dict)
    priority: str = Field(default="MEDIUM", description="Priority level: HIGH, MEDIUM, LOW")
    urgency: str = Field(default="MODERATE", description="Urgency status: CRITICAL, HIGH, MODERATE, LOW")
    hospital_id: Optional[uuid.UUID] = Field(None, description="Registering hospital ID")

    @field_validator("blood_group")
    @classmethod
    def validate_blood_group(cls, v: str) -> str:
        v_clean = v.strip().upper()
        if v_clean not in VALID_BLOOD_GROUPS:
            raise ValueError(f"Invalid blood group '{v}'. Must be one of {', '.join(sorted(VALID_BLOOD_GROUPS))}.")
        return v_clean

    @field_validator("required_organ")
    @classmethod
    def validate_required_organ(cls, v: str) -> str:
        v_clean = v.strip().upper()
        if v_clean == "LUNGS":
            v_clean = "LUNG"
        elif v_clean == "PANCREATIC":
            v_clean = "PANCREAS"
        if v_clean not in VALID_ORGANS:
            raise ValueError(f"Invalid required organ '{v}'. Must be one of {', '.join(sorted(VALID_ORGANS))}.")
        return v_clean

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        v_clean = v.strip().upper()
        if v_clean not in VALID_PRIORITIES:
            raise ValueError(f"Invalid priority '{v}'. Must be one of {', '.join(sorted(VALID_PRIORITIES))}.")
        return v_clean

    @field_validator("urgency")
    @classmethod
    def validate_urgency(cls, v: str) -> str:
        v_clean = v.strip().upper()
        if v_clean == "STABLE":
            v_clean = "LOW"
        if v_clean not in VALID_URGENCIES:
            raise ValueError(f"Invalid urgency '{v}'. Must be one of {', '.join(sorted(VALID_URGENCIES))}.")
        return v_clean

class RecipientCreate(RecipientBase):
    pass

class RecipientUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = Field(None, ge=0, le=120)
    blood_group: Optional[str] = None
    required_organ: Optional[str] = None
    medical_details: Optional[Dict[str, Any]] = None
    hla_information: Optional[Dict[str, Any]] = None
    priority: Optional[str] = None
    urgency: Optional[str] = None
    status: Optional[str] = Field(None, description="Status: ACTIVE, INACTIVE, ARCHIVED")

    @field_validator("blood_group")
    @classmethod
    def validate_blood_group_opt(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v_clean = v.strip().upper()
        if v_clean not in VALID_BLOOD_GROUPS:
            raise ValueError(f"Invalid blood group '{v}'. Must be one of {', '.join(sorted(VALID_BLOOD_GROUPS))}.")
        return v_clean

    @field_validator("required_organ")
    @classmethod
    def validate_required_organ_opt(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v_clean = v.strip().upper()
        if v_clean == "LUNGS":
            v_clean = "LUNG"
        elif v_clean == "PANCREATIC":
            v_clean = "PANCREAS"
        if v_clean not in VALID_ORGANS:
            raise ValueError(f"Invalid required organ '{v}'. Must be one of {', '.join(sorted(VALID_ORGANS))}.")
        return v_clean

    @field_validator("priority")
    @classmethod
    def validate_priority_opt(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v_clean = v.strip().upper()
        if v_clean not in VALID_PRIORITIES:
            raise ValueError(f"Invalid priority '{v}'. Must be one of {', '.join(sorted(VALID_PRIORITIES))}.")
        return v_clean

    @field_validator("urgency")
    @classmethod
    def validate_urgency_opt(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v_clean = v.strip().upper()
        if v_clean == "STABLE":
            v_clean = "LOW"
        if v_clean not in VALID_URGENCIES:
            raise ValueError(f"Invalid urgency '{v}'. Must be one of {', '.join(sorted(VALID_URGENCIES))}.")
        return v_clean

class RecipientResponse(RecipientBase):
    id: uuid.UUID
    status: str
    created_by: uuid.UUID
    updated_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }

class RecipientDetailResponse(RecipientResponse):
    hospital_name: Optional[str] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    created_by_role: Optional[str] = None
    updated_by_role: Optional[str] = None
    medical_suitability: Optional[str] = None
    medical_notes: Optional[str] = None

