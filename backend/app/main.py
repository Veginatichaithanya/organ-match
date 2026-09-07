import sys
import asyncio
import uuid
from datetime import datetime

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import app.database.base
from fastapi import FastAPI, Request, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database.session import async_session_maker
from app.security.rbac import PermissionDeniedError
from app.services.authorization_service import ABACDeniedError
from app.models.audit import AuditLog
from app.models.user import User


# Import routers
from app.api.auth import router as auth_router
from app.api.dashboard import router as dashboard_router
from app.api.donors import router as donors_router
from app.api.recipients import router as recipients_router
from app.api.organs import router as organs_router
from app.api.matching import router as matching_router
from app.api.allocations import router as allocations_router
from app.api.blockchain import router as blockchain_router
from app.api.pqc import router as pqc_router
from app.api.hospitals import router as hospitals_router
from app.api.users import router as users_router
from app.api.admin import router as admin_router
from app.api.coordinator import router as coordinator_router
from app.api.doctor import router as doctor_router
from app.api.allocation_authority import router as allocation_authority_router
from app.api.system_monitoring import router as system_monitoring_router

app = FastAPI(
    title="Secure Organ Donation Matching and Tamper Detection System",
    description="Academic prototype mapping secure organ matching, RBAC/ABAC policy engine, and Hyperledger Fabric anchoring.",
    version="1.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json"
)

# CORS configuration
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://localhost:8000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Request Counter Middleware (feeds real-time monitoring stats) ─────────────
from starlette.middleware.base import BaseHTTPMiddleware

class RequestCounterMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        from app.api.system_monitoring import increment_request_counter
        response = await call_next(request)
        increment_request_counter(response.status_code)
        return response

app.add_middleware(RequestCounterMiddleware)

# Mount API routers under /api prefix
app.include_router(auth_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(donors_router, prefix="/api")
app.include_router(recipients_router, prefix="/api")
app.include_router(organs_router, prefix="/api")
app.include_router(matching_router, prefix="/api")
app.include_router(allocations_router, prefix="/api")
app.include_router(allocation_authority_router, prefix="/api")
app.include_router(blockchain_router, prefix="/api")
app.include_router(pqc_router, prefix="/api")
app.include_router(hospitals_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(coordinator_router, prefix="/api")
app.include_router(coordinator_router, prefix="/api/hospital")
app.include_router(doctor_router, prefix="/api")
app.include_router(system_monitoring_router, prefix="/api")



# --- Health check endpoints ---

@app.get("/health")
async def health_check():
    """
    Standard service health check.
    """
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/health/database")
async def database_health():
    """
    Check if the PostgreSQL database connection is alive.
    """
    try:
        async with async_session_maker() as session:
            await session.execute(select(1))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "unhealthy", "database": f"error: {str(e)}"}
        )

@app.on_event("startup")
async def startup_event():
    """Initialize Hyperledger Fabric connection client and ensure demo datasets are seeded."""
    from app.blockchain.fabric_gateway import fabric_gateway
    await fabric_gateway.connect()
    # Demo data is intentionally NOT seeded automatically on startup.
    # To seed demo data, run `backend/app/database/seed_demo.py` manually.
    pass

@app.get("/health/blockchain")
async def blockchain_health():
    """
    Check Hyperledger Fabric network connection status.
    """
    from app.blockchain.fabric_gateway import fabric_gateway
    if not fabric_gateway.configured:
        return {"status": "ok", "blockchain": "not_configured"}
    if not fabric_gateway.connected:
        return {"status": "unhealthy", "blockchain": "disconnected"}
    return {"status": "healthy", "blockchain": "connected"}

# --- Security Exception Handlers (Tampering Classification) ---

@app.exception_handler(PermissionDeniedError)
async def rbac_denied_handler(request: Request, exc: PermissionDeniedError):
    """
    Handles RBAC permission failures. Categorizes as INTERNAL tampering.
    """
    request_id = str(uuid.uuid4())
    event_code = f"SEC-RBAC-{uuid.uuid4().hex[:8].upper()}"

    try:
        async with async_session_maker() as db:
            user_query = (
                select(User)
                .where(User.username == exc.username)
                .options(selectinload(User.roles), selectinload(User.hospital))
            )
            res = await db.execute(user_query)
            user = res.scalars().first()
            
            audit = AuditLog(
                user_id=user.id if user else None,
                username=exc.username,
                role=user.roles[0].name if user and user.roles else "guest",
                organization=user.hospital.name if user and user.hospital else "Central Authority",
                operation=f"{request.method} {request.url.path}",
                entity_type="API_Route",
                entity_id=None,
                result="DENIED",
                reason=exc.detail,
                ip_address=request.client.host if request.client else "127.0.0.1",
                user_agent=request.headers.get("user-agent", "Unknown")
            )
            db.add(audit)
            await db.commit()
    except Exception:
        pass

    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={
            "error": {
                "code": "PERMISSION_DENIED",
                "message": exc.detail,
                "request_id": request_id,
                "event_code": event_code
            }
        }
    )

@app.exception_handler(ABACDeniedError)
async def abac_denied_handler(request: Request, exc: ABACDeniedError):
    """
    Handles ABAC attribute failures. Categorizes as INTERNAL tampering.
    """
    request_id = str(uuid.uuid4())
    event_code = f"SEC-ABAC-{uuid.uuid4().hex[:8].upper()}"
    decision = exc.decision

    try:
        async with async_session_maker() as db:
            user_query = (
                select(User)
                .where(User.username == decision["actor"])
                .options(selectinload(User.roles), selectinload(User.hospital))
            )
            res = await db.execute(user_query)
            user = res.scalars().first()

            audit = AuditLog(
                user_id=user.id if user else None,
                username=decision["actor"],
                role=user.roles[0].name if user and user.roles else "guest",
                organization=user.hospital.name if user and user.hospital else "Central Authority",
                operation=decision["operation"],
                entity_type=decision["resource"],
                entity_id=None,
                result="DENIED",
                reason=decision["reason"],
                ip_address=request.client.host if request.client else "127.0.0.1",
                user_agent=request.headers.get("user-agent", "Unknown")
            )
            db.add(audit)
            await db.commit()
    except Exception:
        pass

    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={
            "error": {
                "code": "ABAC_VIOLATION",
                "message": exc.detail,
                "request_id": request_id,
                "event_code": event_code
            }
        }
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Catches basic HTTPExceptions.
    Categorizes 401 Unauthorized errors (failed JWT checks, signatures) as EXTERNAL tampering.
    """
    request_id = str(uuid.uuid4())
    
    # Check if this is an authentication failure
    if exc.status_code == status.HTTP_401_UNAUTHORIZED:
        event_code = f"SEC-EXT-{uuid.uuid4().hex[:8].upper()}"
        
        try:
            async with async_session_maker() as db:
                audit = AuditLog(
                    user_id=None,
                    username="Anonymous/External Attacker",
                    role="guest",
                    organization="External Network",
                    operation=f"{request.method} {request.url.path}",
                    entity_type="API_Route",
                    entity_id=None,
                    result="DENIED",
                    reason=exc.detail,
                    ip_address=request.client.host if request.client else "127.0.0.1",
                    user_agent=request.headers.get("user-agent", "Unknown")
                )
                db.add(audit)
                await db.commit()
        except Exception:
            # Fallback if DB logging fails during standalone unit tests
            pass

        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={
                "error": {
                    "code": "AUTHENTICATION_FAILED",
                    "message": exc.detail,
                    "request_id": request_id,
                    "event_code": event_code
                }
            }
        )

    # General exceptions fallback
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": "API_ERROR",
                "message": exc.detail,
                "request_id": request_id
            }
        }
    )
