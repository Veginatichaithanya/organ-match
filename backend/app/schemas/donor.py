import uuid
from datetime import datetime, date
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator

VALID_BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]

class DonationPreferences(BaseModel):
    organs: List[str] = Field(default_factory=list, description="Selected organs to donate")
    tissues: List[str] = Field(default_factory=list, description="Selected tissues to donate")
    other_organs: Optional[str] = Field(None, description="Specification if Other Organs is selected")
    other_tissues: Optional[str] = Field(None, description="Specification if Other Tissues is selected")

class DonorBase(BaseModel):
    donor_code: Optional[str] = Field(None, description="Unique code identifying the donor (e.g., DNR-001)")
    name: Optional[str] = Field(None, min_length=1, description="Full name of the donor")
    age: Optional[int] = Field(None, ge=0, le=120, description="Age of the donor")
    date_of_birth: Optional[date] = Field(None, description="Date of birth")
    gender: Optional[str] = Field("Not specified", description="Gender (Male, Female, Other)")
    contact_number: Optional[str] = Field(None, description="Primary contact phone number")
    residential_address: Optional[str] = Field(None, description="Residential street/mailing address")
    blood_group: Optional[str] = Field(None, description="Blood group of the donor (e.g., O+, A-, AB+)")
    donation_preferences: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Donation preferences for organs and tissues")
    declaration_acknowledged: Optional[bool] = Field(True, description="Acknowledgment of declaration")
    registration_date: Optional[date] = Field(None, description="Date of registration")
    hla_information: Optional[Dict[str, Any]] = Field(default_factory=dict, description="HLA typing antigens")
    medical_details: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Medical parameters and suitability details")
    hospital_id: Optional[uuid.UUID] = Field(None, description="ID of the registering hospital")

    @field_validator("date_of_birth")
    @classmethod
    def validate_dob(cls, v: Optional[date]) -> Optional[date]:
        if v and v > date.today():
            raise ValueError("Date of birth cannot be in the future.")
        return v

    @field_validator("registration_date")
    @classmethod
    def validate_reg_date(cls, v: Optional[date]) -> Optional[date]:
        if v and v > date.today():
            raise ValueError("Registration date cannot be in the future.")
        return v

class DonorCreate(DonorBase):
    blood_group: Optional[str] = Field(None, description="Blood group of the donor (A+, A-, B+, B-, AB+, AB-, O+, O-)")

    @field_validator("declaration_acknowledged")
    @classmethod
    def validate_declaration(cls, v: Optional[bool]) -> Optional[bool]:
        if v is False:
            raise ValueError("Please acknowledge the declaration before submitting.")
        return v

    @field_validator("blood_group")
    @classmethod
    def validate_blood_group(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v != "" and v not in VALID_BLOOD_GROUPS:
            raise ValueError(f"Invalid blood group. Must be one of: {', '.join(VALID_BLOOD_GROUPS)}")
        return v

class DonorUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = Field(None, ge=0, le=120)
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    contact_number: Optional[str] = None
    residential_address: Optional[str] = None
    blood_group: Optional[str] = None
    donation_preferences: Optional[Dict[str, Any]] = None
    declaration_acknowledged: Optional[bool] = None
    registration_date: Optional[date] = None
    hla_information: Optional[Dict[str, Any]] = None
    medical_details: Optional[Dict[str, Any]] = None
    status: Optional[str] = Field(None, description="Status: ACTIVE, INACTIVE, ARCHIVED")

    @field_validator("blood_group")
    @classmethod
    def validate_blood_group_update(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v != "" and v not in VALID_BLOOD_GROUPS:
            raise ValueError(f"Invalid blood group. Must be one of: {', '.join(VALID_BLOOD_GROUPS)}")
        return v

class DonorResponse(DonorBase):
    id: uuid.UUID
    age: int
    status: str
    created_by: uuid.UUID
    updated_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat(),
            date: lambda d: d.isoformat()
        }

class DonorDetailResponse(DonorResponse):
    hospital_name: Optional[str] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    created_by_role: Optional[str] = None
    updated_by_role: Optional[str] = None
    medical_suitability: Optional[str] = None # "APPROVED" | "NOT_APPROVED" | "NEEDS_REVIEW" | "Not Assessed"
    medical_notes: Optional[str] = None

