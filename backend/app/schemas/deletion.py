import uuid
from pydantic import BaseModel, Field, field_validator

class DeletionRequest(BaseModel):
    reason: str = Field(
        ...,
        description="Mandatory reason for deleting the record (minimum 10 characters, max 500 characters)."
    )

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Please provide a deletion reason (minimum 10 characters).")
        trimmed = v.strip()
        if len(trimmed) < 10:
            raise ValueError("Please provide a deletion reason (minimum 10 characters).")
        if len(trimmed) > 500:
            raise ValueError("Deletion reason cannot exceed 500 characters.")
        return trimmed

class DeletionResponse(BaseModel):
    message: str
    id: str
    entity_type: str
    reason: str
