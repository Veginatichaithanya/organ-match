from typing import List
from fastapi import APIRouter, Depends, Query
from app.schemas.pqc import PQCMetricsResponse
from app.security.pqc import PQCService
from app.security.rbac import RequirePermission

router = APIRouter(
    prefix="/pqc",
    tags=["Post-Quantum Cryptography"],
    dependencies=[Depends(RequirePermission("VIEW_SECURITY"))] # Restricted to auditor/admin/authorized users
)

@router.get("/metrics", response_model=List[PQCMetricsResponse])
async def get_pqc_metrics():
    """
    Retrieve performance overhead metrics comparing classical algorithms to NIST PQC standards.
    """
    return PQCService.get_metrics()

@router.post("/handshake")
async def run_pqc_handshake(
    algorithm: str = Query("CRYSTALS-Kyber-768", description="Alg: CRYSTALS-Kyber-768, CRYSTALS-Dilithium3, Falcon-512")
):
    """
    Simulate a post-quantum cryptographic exchange, returning sizes and latency benchmarks.
    """
    return PQCService.simulate_pqc_handshake(algorithm)
