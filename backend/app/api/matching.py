import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database.session import get_db
from app.models.user import User
from app.models.organ import Organ
from app.models.match import Match
from app.models.donor import Donor
from app.schemas.matching import MatchRunRequest, MatchResultResponse
from app.security.authentication import get_current_user
from app.services.matching_service import MatchingService
from app.services.authorization_service import AuthorizationService

router = APIRouter(prefix="/matching", tags=["Matching"])

@router.post("/run", response_model=List[MatchResultResponse])
async def run_matching(
    payload: MatchRunRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Run the compatibility matching and ranking engine for an organ.
    Restricted to authorized coordinators or center personnel.
    """
    # Fetch organ and nested donor to check hospital ID context
    organ_query = (
        select(Organ)
        .where(Organ.id == payload.organ_id)
        .options(selectinload(Organ.donor))
    )
    organ_result = await db.execute(organ_query)
    organ = organ_result.scalars().first()

    if not organ:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organ not found."
        )

    # Validate operation permissions and context bounds (ABAC)
    AuthorizationService.authorize(
        user=current_user,
        permission_name="RUN_MATCHING",
        resource_type="Organ",
        operation="RUN_MATCHING",
        resource=organ
    )

    # Derive hospital scope for the candidate pool.
    # Hospital Coordinators and Doctors may only evaluate recipients belonging to
    # their own hospital — this enforces the same boundary that ABAC applies on
    # individual recipient reads, but at match-generation time so cross-hospital
    # recipient IDs never appear in matching results.
    # Roles with broader scope (ADMIN, ALLOCATION_AUTHORITY, AUDITOR) receive the
    # full unfiltered recipient waitlist (caller_hospital_id=None).
    _role = current_user.roles[0].name if current_user.roles else ""
    scoped_hospital_id = (
        current_user.hospital_id
        if _role in ("HOSPITAL_COORDINATOR", "DOCTOR")
        else None
    )

    try:
        # Run matching with appropriate candidate scope
        matches = await MatchingService.run_matching(payload.organ_id, db, scoped_hospital_id)

        return matches
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/organ/{organ_id}", response_model=List[MatchResultResponse])
async def get_matches_for_organ(
    organ_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve ranked matches computed for a specific organ.
    """
    organ_query = select(Organ).where(Organ.id == organ_id).options(selectinload(Organ.donor))
    organ_result = await db.execute(organ_query)
    organ = organ_result.scalars().first()

    if not organ:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organ not found."
        )

    # Validate viewing permission on this organ context
    AuthorizationService.authorize(
        user=current_user,
        permission_name="VIEW_MATCH",
        resource_type="Organ",
        operation="READ",
        resource=organ
    )

    role_name = current_user.roles[0].name if current_user.roles else ""

    # Retrieve all matches sorted by rank (scoped to user's hospital for coordinator/doctor)
    matches_query = (
        select(Match)
        .where(Match.organ_id == organ_id)
        .options(selectinload(Match.recipient))
    )
    if role_name in ["HOSPITAL_COORDINATOR", "DOCTOR"] and current_user.hospital_id:
        from app.models.recipient import Recipient
        matches_query = matches_query.join(Recipient, Match.recipient_id == Recipient.id).where(Recipient.hospital_id == current_user.hospital_id)
    matches_query = matches_query.order_by(Match.rank)

    matches_result = await db.execute(matches_query)
    return matches_result.scalars().all()

@router.get("/{id}", response_model=MatchResultResponse)
async def get_match(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve details of a single match record.
    """
    match_query = select(Match).where(Match.id == id).options(selectinload(Match.organ).selectinload(Organ.donor), selectinload(Match.recipient))
    match_result = await db.execute(match_query)
    match = match_result.scalars().first()

    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found."
        )

    # Validate context: Check if the user is authorized to read matches linked to this organ
    AuthorizationService.authorize(
        user=current_user,
        permission_name="VIEW_MATCH",
        resource_type="Organ",
        operation="READ",
        resource=match.organ
    )

    role_name = current_user.roles[0].name if current_user.roles else ""
    if role_name in ["HOSPITAL_COORDINATOR", "DOCTOR"] and current_user.hospital_id:
        if match.recipient and match.recipient.hospital_id != current_user.hospital_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation 'READ' denied. This record belongs to another hospital."
            )

    return match
