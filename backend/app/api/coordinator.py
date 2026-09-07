import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func

from app.database.session import get_db
from app.models.user import User
from app.models.hospital import Hospital
from app.models.donor import Donor
from app.models.recipient import Recipient
from app.models.organ import Organ
from app.models.match import Match
from app.models.allocation import Allocation
from app.schemas.coordinator import CoordinatorOverviewResponse
from app.schemas.deletion import DeletionRequest, DeletionResponse
from app.security.authentication import get_current_user
from app.services.authorization_service import AuthorizationService
from app.services.deletion_service import DeletionService

router = APIRouter(prefix="/coordinator", tags=["Coordinator"])



@router.get("/overview", response_model=CoordinatorOverviewResponse)
async def get_coordinator_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns operational metrics strictly isolated to the coordinator's assigned hospital.
    """
    role_name = current_user.roles[0].name if current_user.roles else "guest"
    
    # Allow HOSPITAL_COORDINATOR, DOCTOR, and ADMIN
    if role_name not in ["HOSPITAL_COORDINATOR", "DOCTOR", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Hospital Coordinators."
        )

    hospital_id = current_user.hospital_id
    hospital_name = "Central Network"

    if hospital_id:
        hosp = await db.get(Hospital, hospital_id)
        if hosp:
            hospital_name = hosp.name

    # 1. Active Donors in this hospital
    donor_query = select(func.count(Donor.id)).where(Donor.status == "ACTIVE")
    if hospital_id:
        donor_query = donor_query.where(Donor.hospital_id == hospital_id)
    active_donors = (await db.execute(donor_query)).scalar() or 0

    # 2. Available Organs from this hospital's donors
    organ_query = (
        select(func.count(Organ.id))
        .join(Donor, Organ.donor_id == Donor.id)
        .where(Organ.status == "AVAILABLE")
    )
    if hospital_id:
        organ_query = organ_query.where(Donor.hospital_id == hospital_id)
    available_organs = (await db.execute(organ_query)).scalar() or 0

    # 3. Active Recipients in this hospital
    recip_query = select(func.count(Recipient.id)).where(Recipient.status == "ACTIVE")
    if hospital_id:
        recip_query = recip_query.where(Recipient.hospital_id == hospital_id)
    active_recipients = (await db.execute(recip_query)).scalar() or 0

    # 4. Pending Medical Review (Assessments with suitability == "NEEDS_REVIEW")
    from app.models.medical_assessment import MedicalAssessment
    pending_rev_q = select(func.count(MedicalAssessment.id)).where(MedicalAssessment.suitability == "NEEDS_REVIEW")
    if hospital_id:
        pending_rev_q = pending_rev_q.join(User, MedicalAssessment.reviewed_by == User.id).where(User.hospital_id == hospital_id)
    pending_reviews = (await db.execute(pending_rev_q)).scalar() or 0

    # 5. Active Matches for this hospital's organs
    match_query = (
        select(func.count(Match.id))
        .join(Organ, Match.organ_id == Organ.id)
        .join(Donor, Organ.donor_id == Donor.id)
        .where(Match.status == "PENDING")
    )
    if hospital_id:
        match_query = match_query.where(Donor.hospital_id == hospital_id)
    active_matches = (await db.execute(match_query)).scalar() or 0

    # 6. Pending Allocations
    alloc_query = (
        select(func.count(Allocation.id))
        .join(Organ, Allocation.organ_id == Organ.id)
        .join(Donor, Organ.donor_id == Donor.id)
        .where(Allocation.status == "PENDING")
    )
    if hospital_id:
        alloc_query = alloc_query.where(Donor.hospital_id == hospital_id)
    pending_allocations = (await db.execute(alloc_query)).scalar() or 0

    # Recent donors list
    recent_donors_q = select(Donor).order_by(Donor.created_at.desc()).limit(5)
    if hospital_id:
        recent_donors_q = recent_donors_q.where(Donor.hospital_id == hospital_id)
    recent_donors_res = await db.execute(recent_donors_q)
    recent_donors = [
        {
            "id": str(d.id),
            "code": d.donor_code,
            "name": d.name or "Anonymous Donor",
            "age": d.age,
            "blood_group": d.blood_group,
            "status": d.status,
            "created_at": d.created_at.isoformat() if d.created_at else "",
        }
        for d in recent_donors_res.scalars().all()
    ]

    # Recent organs list
    recent_organs_q = (
        select(Organ)
        .join(Donor, Organ.donor_id == Donor.id)
        .order_by(Organ.created_at.desc())
        .limit(5)
    )
    if hospital_id:
        recent_organs_q = recent_organs_q.where(Donor.hospital_id == hospital_id)
    recent_organs_res = await db.execute(recent_organs_q)
    recent_organs = [
        {
            "id": str(o.id),
            "code": o.organ_code,
            "organ_type": o.organ_type,
            "blood_group": o.blood_group,
            "status": o.status,
            "created_at": o.created_at.isoformat() if o.created_at else "",
        }
        for o in recent_organs_res.scalars().all()
    ]

    # Recent recipients list
    recent_recip_q = select(Recipient).order_by(Recipient.created_at.desc()).limit(5)
    if hospital_id:
        recent_recip_q = recent_recip_q.where(Recipient.hospital_id == hospital_id)
    recent_recip_res = await db.execute(recent_recip_q)
    recent_recipients = [
        {
            "id": str(r.id),
            "code": r.recipient_code,
            "name": r.name or "Anonymous Recipient",
            "age": r.age,
            "required_organ": r.required_organ,
            "blood_group": r.blood_group,
            "priority": r.priority,
            "urgency": r.urgency,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in recent_recip_res.scalars().all()
    ]

    return CoordinatorOverviewResponse(
        hospital_id=hospital_id,
        hospital_name=hospital_name,
        active_donors=active_donors,
        available_organs=available_organs,
        active_recipients=active_recipients,
        pending_medical_reviews=pending_reviews,
        active_matches=active_matches,
        pending_allocations=pending_allocations,
        recent_donors=recent_donors,
        recent_organs=recent_organs,
        recent_recipients=recent_recipients,
    )


@router.delete("/{entity}/{entity_id}", response_model=DeletionResponse)
async def delete_coordinator_entity(
    entity: str,
    entity_id: uuid.UUID,
    payload: DeletionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Secure deletion endpoint for hospital coordinator to delete a Donor, Recipient, or Organ
    with mandatory justification, ABAC enforcement, dependency safety, and immutable audit logging.
    """
    return await DeletionService.delete_record(
        db=db,
        current_user=current_user,
        entity_type_str=entity,
        entity_id=entity_id,
        reason=payload.reason
    )

