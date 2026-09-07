from pydantic import BaseModel, Field

class PQCMetricsResponse(BaseModel):
    algorithm: str = Field(..., description="Name of the cryptographic algorithm")
    type: str = Field(..., description="Type: Signature, KEM, or Asymmetric Encryption")
    key_size_bytes: int = Field(..., description="Public key size in bytes")
    signature_size_bytes: int = Field(..., description="Signature or Ciphertext size in bytes")
    latency_ms: float = Field(..., description="Average operation execution speed in milliseconds")
    security_level: str = Field(..., description="NIST security standard certification level")
    overhead_multiplier: float = Field(..., description="Relative payload overhead compared to ECC-256")
