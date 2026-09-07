import uuid
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field

class LoginRequest(BaseModel):
    username_or_email: str = Field(..., description="Username or Email address of the account")
    password: str = Field(..., description="Account login password")

class UserSessionProfile(BaseModel):
    id: uuid.UUID
    username: str
    email: EmailStr
    role: str
    hospital_id: Optional[uuid.UUID] = None
    hospital_name: Optional[str] = None
    permissions: List[str]

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserSessionProfile

class UserMeResponse(BaseModel):
    user: UserSessionProfile

class RefreshTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
