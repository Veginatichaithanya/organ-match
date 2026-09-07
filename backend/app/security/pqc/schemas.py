"""
Pydantic Schemas for Post-Quantum Cryptography (PQC) Monitoring & Verification
Never include private keys or secret material in schema models.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class PQCStatusResponse(BaseModel):
    enabled: bool = Field(..., description="Whether PQC layer is enabled")
    algorithm: str = Field(..., description="NIST Standardized algorithm name (e.g. ML-KEM-768)")
    key_status: str = Field(..., description="AVAILABLE | UNINITIALIZED | ERROR")
    public_key_available: bool = Field(..., description="Whether valid public key exists")
    key_directory: str = Field(..., description="Local key storage directory name")
    last_verification: datetime = Field(..., description="Timestamp of status check")

class PQCTestResponse(BaseModel):
    algorithm: str = Field(..., description="Cryptographic algorithm tested")
    encapsulation: str = Field(..., description="SUCCESS | FAILED")
    decapsulation: str = Field(..., description="SUCCESS | FAILED")
    shared_secret_match: bool = Field(..., description="Whether derived shared secrets match perfectly")
    timestamp: datetime = Field(..., description="Verification timestamp")

class PQCBenchmarkResponse(BaseModel):
    algorithm: str = Field(..., description="Cryptographic algorithm benchmarked")
    keygen_ms: float = Field(..., description="Average key generation time in milliseconds")
    encapsulation_ms: float = Field(..., description="Average encapsulation time in milliseconds")
    decapsulation_ms: float = Field(..., description="Average decapsulation time in milliseconds")
    shared_secret_match: bool = Field(..., description="Verification match result")
    timestamp: datetime = Field(..., description="Benchmark execution timestamp")
