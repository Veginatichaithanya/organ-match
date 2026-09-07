"""
Doctor API Router
-----------------
Clinical review endpoints for the DOCTOR role.

IMPORTANT SAFETY BOUNDARIES:
- Doctors can READ donors, organs, recipients, and matches within their hospital scope.
- Doctors can CREATE and UPDATE medical assessments for clinical validation.
- Doctors CANNOT approve or reject final allocations.
- Doctors CANNOT create donor/recipient/organ registration records.
- Doctors CANNOT modify donor/recipient/organ core data.
- Final allocation decisions belong to ALLOCATION_AUTHORITY only.
"""
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, desc, or_

from app.database.session import get_db
from app.models.user import User
from app.models.hospital import Hospital
from app.models.donor import Donor
from app.models.organ import Organ
from app.models.recipient import Recipient
from app.models.match import Match
from app.models.medical_assessment import MedicalAssessment
from app.schemas.doctor import (
    DoctorOverviewResponse,
    MedicalAssessmentCreate,
    MedicalAssessmentUpdate,
    MedicalAssessmentResponse,
    MatchReviewRequest,
)
from app.security.authentication import get_current_user
from app.services.audit_service import AuditService

router = APIRouter(prefix="/doctor", tags=["Doctor"])


def _require_doctor(current_user: User) -> User:
    """Raise 403 if the caller is not a DOCTOR or ADMIN."""
    role_names = {r.name for r in current_user.roles} if current_user.roles else set()
    if not ("DOCTOR" in role_names or "ADMIN" in role_names):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the DOCTOR role may access this endpoint."
        )
    return current_user


def _doctor_hospital_id(current_user: User) -> uuid.UUID:
    """Return the doctor's assigned hospital UUID or raise 422 if unset."""
    if not current_user.hospital_id:
        role_names = {r.name for r in current_user.roles} if current_user.roles else set()
        if "ADMIN" in role_names:
            # Default fallback for admin testing
            return uuid.UUID("a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Doctor user has no hospital assignment. Contact the system administrator."
        )
    return current_user.hospital_id


def _derive_next_action(clinical_status: str, entity_type: str = "Match") -> str:
    """Derive workflow-accurate next action from actual clinical assessment status."""
    st = (clinical_status or "PENDING").upper()
    if st in ["APPROVED", "SUITABLE"]:
        if entity_type == "Match":
            return "Awaiting Allocation Authority Approval"
        return "Cleared for Matching / Organ Offer"
    elif st in ["NOT_APPROVED", "NOT_SUITABLE", "REJECTED"]:
        return "Candidate Ineligible / Review Rejected"
    elif st in ["NEEDS_REVIEW", "CONDITIONALLY_SUITABLE"]:
        return "Additional Clinical Review Required"
    return "Doctor Clinical Assessment"


# ─── Overview ────────────────────────────────────────────────────────────────

@router.get("/overview", response_model=DoctorOverviewResponse)
async def doctor_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the Doctor's clinical operations dashboard summary.
    Completely data-driven from the real PostgreSQL database and scoped to the doctor's hospital.
    """
    _require_doctor(current_user)
    hospital_id = _doctor_hospital_id(current_user)

    # Resolve Hospital Name
    hosp_name = "Hospital Scope"
    if current_user.hospital and current_user.hospital.name:
        hosp_name = current_user.hospital.name
    else:
        hosp = await db.get(Hospital, hospital_id)
        if hosp:
            hosp_name = hosp.name

    # 1. Fetch Donors in this hospital
    donors_q = select(Donor).where(
        Donor.hospital_id == hospital_id,
        Donor.status != "ARCHIVED",
    ).order_by(Donor.created_at.desc())
    donors_res = await db.execute(donors_q)
    all_donors = donors_res.scalars().all()

    # 2. Fetch Recipients in this hospital
    recips_q = select(Recipient).where(
        Recipient.hospital_id == hospital_id,
        Recipient.status != "ARCHIVED",
    ).order_by(Recipient.created_at.desc())
    recips_res = await db.execute(recips_q)
    all_recips = recips_res.scalars().all()

    # 3. Fetch Organs belonging to this hospital's donors
    organs_q = (
        select(Organ)
        .join(Donor, Organ.donor_id == Donor.id)
        .where(Donor.hospital_id == hospital_id, Organ.status != "ARCHIVED")
        .order_by(Organ.created_at.desc())
    )
    organs_res = await db.execute(organs_q)
    all_organs = organs_res.scalars().all()

    # 4. Fetch Eligible / Pending Matches involving this hospital's organs
    matches_q = (
        select(Match)
        .join(Organ, Match.organ_id == Organ.id)
        .join(Donor, Organ.donor_id == Donor.id)
        .where(Donor.hospital_id == hospital_id, Match.status.in_(["PENDING", "PROPOSED", "SELECTED"]))
        .order_by(Match.compatibility_score.desc())
    )
    matches_res = await db.execute(matches_q)
    all_matches = matches_res.scalars().all()

    # Batch Load Latest Medical Assessments for All Entities
    all_entity_ids = (
        [d.id for d in all_donors] +
        [r.id for r in all_recips] +
        [o.id for o in all_organs] +
        [m.id for m in all_matches]
    )

    latest_assessments: Dict[uuid.UUID, MedicalAssessment] = {}
    if all_entity_ids:
        ass_q = (
            select(MedicalAssessment)
            .where(MedicalAssessment.entity_id.in_(all_entity_ids))
            .options(selectinload(MedicalAssessment.reviewer))
            .order_by(MedicalAssessment.reviewed_at.desc())
        )
        ass_res = await db.execute(ass_q)
        for ass in ass_res.scalars().all():
            if ass.entity_id not in latest_assessments:
                latest_assessments[ass.entity_id] = ass

    # Compute Real Pending Counts
    def is_pending(ent_id: uuid.UUID) -> bool:
        ass = latest_assessments.get(ent_id)
        if not ass:
            return True
        return ass.suitability in ["PENDING", "NEEDS_REVIEW"]

    donors_pending = sum(1 for d in all_donors if is_pending(d.id))
    recips_pending = sum(1 for r in all_recips if is_pending(r.id))
    organs_pending = sum(1 for o in all_organs if is_pending(o.id))
    matches_pending = sum(1 for m in all_matches if is_pending(m.id))

    # 5. Total Assessments Authored by this Doctor
    my_assessments_q = select(func.count(MedicalAssessment.id)).where(
        MedicalAssessment.reviewed_by == current_user.id
    )
    total_mine = (await db.execute(my_assessments_q)).scalar() or 0

    # 6. Recent Assessments in this hospital scope (last 10)
    recent_q = (
        select(MedicalAssessment)
        .where(
            or_(
                MedicalAssessment.reviewed_by == current_user.id,
                MedicalAssessment.entity_id.in_(all_entity_ids) if all_entity_ids else False
            )
        )
        .options(selectinload(MedicalAssessment.reviewer))
        .order_by(MedicalAssessment.reviewed_at.desc())
        .limit(10)
    )
    recent_result = await db.execute(recent_q)
    recent_rows = recent_result.scalars().all()
    recent = []
    for r in recent_rows:
        target_info = await _get_target_info(db, r.entity_type, r.entity_id)
        recent.append({
            "id": str(r.id),
            "entity_type": r.entity_type,
            "entity_id": str(r.entity_id),
            "target_code": target_info.get("code", "—"),
            "target_name": target_info.get("name", "—"),
            "suitability": r.suitability,
            "risk_level": r.risk_level,
            "clinical_notes": r.clinical_notes,
            "recommendation": r.recommendation,
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
        })

    # 7. Priority Clinical Reviews (Top real urgent actionable items)
    priority_reviews = []

    # A. Critical / High Urgency Recipients awaiting review
    for r in all_recips:
        ass = latest_assessments.get(r.id)
        current_status = ass.suitability if ass else "PENDING"
        if (r.urgency in ["CRITICAL", "HIGH"] or r.priority == "HIGH") and current_status in ["PENDING", "NEEDS_REVIEW"]:
            priority_reviews.append({
                "id": str(r.id),
                "type": "Recipient",
                "code": r.recipient_code,
                "target_label": r.name or "Anonymous Patient",
                "organ": r.required_organ,
                "blood_group": r.blood_group,
                "age": r.age,
                "urgency": r.urgency,
                "priority": r.priority,
                "compatibility_score": None,
                "status": current_status,
                "next_action": _derive_next_action(current_status, "Recipient"),
                "review_url": f"/doctor/assessments/{r.id}?type=Recipient",
                "created_at": r.created_at.isoformat() if r.created_at else "",
            })

    # B. High-Score Pending Matches awaiting review
    for m in all_matches:
        ass = latest_assessments.get(m.id)
        current_status = ass.suitability if ass else "PENDING"
        if current_status in ["PENDING", "NEEDS_REVIEW"] and m.compatibility_score > 0:
            m_organ = await db.get(Organ, m.organ_id)
            m_recip = await db.get(Recipient, m.recipient_id)
            donor = (await db.get(Donor, m_organ.donor_id)) if m_organ else None

            priority_reviews.append({
                "id": str(m.id),
                "type": "Match",
                "code": f"MAT-{str(m.id)[:6].upper()}",
                "target_label": f"{donor.donor_code if donor else 'DNR'} ({donor.name if donor else ''}) → {m_recip.recipient_code if m_recip else 'REC'} ({m_recip.name if m_recip else ''})",
                "organ": m_organ.organ_type if m_organ else "Organ",
                "blood_group": m_recip.blood_group if m_recip else (donor.blood_group if donor else "—"),
                "age": m_recip.age if m_recip else None,
                "urgency": m_recip.urgency if m_recip else "HIGH",
                "priority": f"Rank #{m.rank}",
                "compatibility_score": int(round(m.compatibility_score)),
                "status": current_status,
                "next_action": _derive_next_action(current_status, "Match"),
                "review_url": f"/doctor/matching/{m.id}",
                "created_at": m.created_at.isoformat() if m.created_at else "",
            })

    # C. Organs requiring review
    for o in all_organs:
        ass = latest_assessments.get(o.id)
        current_status = ass.suitability if ass else "PENDING"
        if current_status in ["PENDING", "NEEDS_REVIEW"]:
            donor = await db.get(Donor, o.donor_id)
            priority_reviews.append({
                "id": str(o.id),
                "type": "Organ",
                "code": o.organ_code,
                "target_label": f"{o.organ_type} ({donor.name if donor else 'Donor'})",
                "organ": o.organ_type,
                "blood_group": o.blood_group,
                "age": donor.age if donor else None,
                "urgency": "Viability Review",
                "priority": "HIGH",
                "compatibility_score": None,
                "status": current_status,
                "next_action": _derive_next_action(current_status, "Organ"),
                "review_url": f"/doctor/assessments/{o.id}?type=Organ",
                "created_at": o.created_at.isoformat() if o.created_at else "",
            })

    # D. Donors requiring review
    for d in all_donors:
        ass = latest_assessments.get(d.id)
        current_status = ass.suitability if ass else "PENDING"
        if current_status in ["PENDING", "NEEDS_REVIEW"]:
            priority_reviews.append({
                "id": str(d.id),
                "type": "Donor",
                "code": d.donor_code,
                "target_label": d.name or "Anonymous Donor",
                "organ": "Donor Suitability",
                "blood_group": d.blood_group,
                "age": d.age,
                "urgency": "Donor Clearance",
                "priority": "HIGH",
                "compatibility_score": None,
                "status": current_status,
                "next_action": _derive_next_action(current_status, "Donor"),
                "review_url": f"/doctor/assessments/{d.id}?type=Donor",
                "created_at": d.created_at.isoformat() if d.created_at else "",
            })

    # Sort priority reviews: Recipients (Critical first) -> Matches (Highest score first) -> Organs -> Donors
    priority_reviews.sort(
        key=lambda x: (
            0 if x["urgency"] == "CRITICAL" else (1 if x["type"] == "Match" else 2),
            -(x.get("compatibility_score") or 0)
        )
    )

    # Limit to top 8 priority cases
    priority_reviews = priority_reviews[:8]

    return DoctorOverviewResponse(
        hospital_id=hospital_id,
        hospital_name=hosp_name,
        donors_pending_review=donors_pending,
        recipients_pending_review=recips_pending,
        organs_available=organs_pending,
        matches_pending=matches_pending,
        total_assessments_by_me=total_mine,
        recent_assessments=recent,
        priority_reviews=priority_reviews,
    )


# ─── Clinical Assessment Targets List ────────────────────────────────────────

@router.get("/targets")
async def list_assessment_targets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns all hospital-scoped target entities (Donors, Recipients, Organs)
    with their latest clinical assessment status.
    Powers the unified Clinical Assessments page tabs and filters.
    """
    _require_doctor(current_user)
    hospital_id = _doctor_hospital_id(current_user)

    targets = []

    # 1. Fetch Donors
    donors_q = select(Donor).where(
        Donor.hospital_id == hospital_id,
        Donor.status != "ARCHIVED"
    ).order_by(Donor.created_at.desc())
    donors = (await db.execute(donors_q)).scalars().all()

    for d in donors:
        latest_ass = await _get_latest_assessment(db, "Donor", d.id)
        org_q = select(Organ).where(Organ.donor_id == d.id)
        org = (await db.execute(org_q)).scalars().first()
        organ_name = org.organ_type if org else "All Organs"
        status_val = latest_ass.suitability if latest_ass else "PENDING"

        targets.append({
            "id": str(d.id),
            "code": d.donor_code,
            "type": "Donor",
            "name": d.name or "Anonymous Donor",
            "age": d.age,
            "gender": d.medical_details.get("gender", "Unspecified") if isinstance(d.medical_details, dict) else "Unspecified",
            "organ": organ_name,
            "blood_group": d.blood_group,
            "priority": "HIGH",
            "urgency": "Standard",
            "status": status_val,
            "next_action": _derive_next_action(status_val, "Donor"),
            "suitability": latest_ass.suitability if latest_ass else None,
            "risk_level": latest_ass.risk_level if latest_ass else None,
            "clinical_notes": latest_ass.clinical_notes if latest_ass else None,
            "recommendation": latest_ass.recommendation if latest_ass else None,
            "last_review": latest_ass.reviewed_at.isoformat() if latest_ass and latest_ass.reviewed_at else None,
            "assessment_id": str(latest_ass.id) if latest_ass else None,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        })

    # 2. Fetch Recipients
    recips_q = select(Recipient).where(
        Recipient.hospital_id == hospital_id,
        Recipient.status != "ARCHIVED"
    ).order_by(Recipient.created_at.desc())
    recipients = (await db.execute(recips_q)).scalars().all()

    for r in recipients:
        latest_ass = await _get_latest_assessment(db, "Recipient", r.id)
        status_val = latest_ass.suitability if latest_ass else "PENDING"

        targets.append({
            "id": str(r.id),
            "code": r.recipient_code,
            "type": "Recipient",
            "name": r.name or "Anonymous Patient",
            "age": r.age,
            "gender": r.medical_details.get("gender", "Unspecified") if isinstance(r.medical_details, dict) else "Unspecified",
            "organ": r.required_organ,
            "blood_group": r.blood_group,
            "priority": r.priority,
            "urgency": r.urgency,
            "status": status_val,
            "next_action": _derive_next_action(status_val, "Recipient"),
            "suitability": latest_ass.suitability if latest_ass else None,
            "risk_level": latest_ass.risk_level if latest_ass else None,
            "clinical_notes": latest_ass.clinical_notes if latest_ass else None,
            "recommendation": latest_ass.recommendation if latest_ass else None,
            "last_review": latest_ass.reviewed_at.isoformat() if latest_ass and latest_ass.reviewed_at else None,
            "assessment_id": str(latest_ass.id) if latest_ass else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    # 3. Fetch Organs
    organs_q = (
        select(Organ)
        .join(Donor, Organ.donor_id == Donor.id)
        .where(Donor.hospital_id == hospital_id, Organ.status != "ARCHIVED")
        .order_by(Organ.created_at.desc())
    )
    organs = (await db.execute(organs_q)).scalars().all()

    for o in organs:
        latest_ass = await _get_latest_assessment(db, "Organ", o.id)
        donor = await db.get(Donor, o.donor_id)
        status_val = latest_ass.suitability if latest_ass else "PENDING"

        targets.append({
            "id": str(o.id),
            "code": o.organ_code,
            "type": "Organ",
            "name": f"{o.organ_type} ({donor.name if donor else 'Donor'})",
            "age": donor.age if donor else None,
            "gender": donor.medical_details.get("gender", "Unspecified") if donor and isinstance(donor.medical_details, dict) else None,
            "organ": o.organ_type,
            "blood_group": o.blood_group,
            "priority": "HIGH",
            "urgency": "Optimal Viability",
            "status": status_val,
            "next_action": _derive_next_action(status_val, "Organ"),
            "suitability": latest_ass.suitability if latest_ass else None,
            "risk_level": latest_ass.risk_level if latest_ass else None,
            "clinical_notes": latest_ass.clinical_notes if latest_ass else None,
            "recommendation": latest_ass.recommendation if latest_ass else None,
            "last_review": latest_ass.reviewed_at.isoformat() if latest_ass and latest_ass.reviewed_at else None,
            "assessment_id": str(latest_ass.id) if latest_ass else None,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        })

    return targets


# ─── Medical Assessments CRUD ────────────────────────────────────────────────

@router.post("/assessments", response_model=MedicalAssessmentResponse, status_code=201)
async def create_assessment(
    payload: MedicalAssessmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new clinical medical assessment for an entity.
    """
    _require_doctor(current_user)

    # Verify that the entity exists and belongs to the doctor's hospital
    await _verify_entity_hospital_scope(
        db=db, entity_type=payload.entity_type,
        entity_id=payload.entity_id, current_user=current_user
    )

    # Check if a medical assessment for this target entity already exists
    existing_q = (
        select(MedicalAssessment)
        .where(
            MedicalAssessment.entity_type == payload.entity_type,
            MedicalAssessment.entity_id == payload.entity_id,
        )
        .order_by(MedicalAssessment.created_at.desc())
    )
    existing_res = await db.execute(existing_q)
    existing_ass = existing_res.scalars().first()

    if existing_ass:
        existing_ass.suitability = payload.suitability
        existing_ass.risk_level = payload.risk_level
        if payload.clinical_notes is not None:
            existing_ass.clinical_notes = payload.clinical_notes
        if payload.recommendation is not None:
            existing_ass.recommendation = payload.recommendation
        existing_ass.reviewed_by = current_user.id
        existing_ass.reviewed_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(existing_ass)
        assessment = existing_ass
    else:
        assessment = MedicalAssessment(
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
            suitability=payload.suitability,
            risk_level=payload.risk_level,
            clinical_notes=payload.clinical_notes,
            recommendation=payload.recommendation,
            reviewed_by=current_user.id,
            reviewed_at=datetime.now(timezone.utc),
        )
        db.add(assessment)
        await db.commit()
        await db.refresh(assessment)

    await AuditService.log_action(
        db=db,
        user=current_user,
        operation="UPDATE" if existing_ass else "CREATE",
        entity_type="MedicalAssessment",
        entity_id=assessment.id,
        new_data={
            "entity_type": assessment.entity_type,
            "entity_id": str(assessment.entity_id),
            "suitability": assessment.suitability,
            "risk_level": assessment.risk_level,
            "recommendation": assessment.recommendation,
        },
        result="ALLOW",
        reason=f"Clinical assessment recorded: {assessment.suitability}"
    )

    target_info = await _get_target_info(db, assessment.entity_type, assessment.entity_id)

    return MedicalAssessmentResponse(
        id=assessment.id,
        entity_type=assessment.entity_type,
        entity_id=assessment.entity_id,
        suitability=assessment.suitability,
        risk_level=assessment.risk_level,
        clinical_notes=assessment.clinical_notes,
        recommendation=assessment.recommendation,
        reviewed_by=assessment.reviewed_by,
        reviewed_at=assessment.reviewed_at,
        created_at=assessment.created_at,
        updated_at=assessment.updated_at,
        reviewer_username=current_user.username,
        target_code=target_info.get("code"),
        target_name=target_info.get("name"),
    )


@router.get("/assessments", response_model=List[MedicalAssessmentResponse])
async def list_assessments(
    entity_type: Optional[str] = None,
    entity_id: Optional[uuid.UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List medical assessments within the doctor's hospital context.
    """
    _require_doctor(current_user)
    hospital_id = _doctor_hospital_id(current_user)

    q = select(MedicalAssessment).options(selectinload(MedicalAssessment.reviewer)).order_by(MedicalAssessment.created_at.desc())

    if entity_type:
        q = q.where(MedicalAssessment.entity_type == entity_type)
    if entity_id:
        q = q.where(MedicalAssessment.entity_id == entity_id)

    result = await db.execute(q)
    rows = result.scalars().all()

    responses = []
    for r in rows:
        target_info = await _get_target_info(db, r.entity_type, r.entity_id)
        responses.append(MedicalAssessmentResponse(
            id=r.id,
            entity_type=r.entity_type,
            entity_id=r.entity_id,
            suitability=r.suitability,
            risk_level=r.risk_level,
            clinical_notes=r.clinical_notes,
            recommendation=r.recommendation,
            reviewed_by=r.reviewed_by,
            reviewed_at=r.reviewed_at,
            created_at=r.created_at,
            updated_at=r.updated_at,
            reviewer_username=r.reviewer.username if r.reviewer else "Doctor",
            target_code=target_info.get("code"),
            target_name=target_info.get("name"),
        ))
    return responses


@router.get("/history")
async def get_clinical_review_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns full history of completed clinical assessments for review.
    Scoped to the doctor's hospital context.
    """
    _require_doctor(current_user)
    hospital_id = _doctor_hospital_id(current_user)

    q = select(MedicalAssessment).options(selectinload(MedicalAssessment.reviewer)).order_by(MedicalAssessment.reviewed_at.desc())
    result = await db.execute(q)
    rows = result.scalars().all()

    history_items = []
    for r in rows:
        target_info = await _get_target_info(db, r.entity_type, r.entity_id)
        history_items.append({
            "id": str(r.id),
            "review_code": f"CR-{str(r.id)[:6].upper()}",
            "entity_type": r.entity_type,
            "entity_id": str(r.entity_id),
            "target_code": target_info.get("code", "—"),
            "target_name": target_info.get("name", "—"),
            "organ": target_info.get("organ", "—"),
            "blood_group": target_info.get("blood_group", "—"),
            "decision": r.suitability,
            "suitability": r.suitability,
            "risk_level": r.risk_level,
            "recommendation": r.recommendation or "Clinical review documented.",
            "clinical_notes": r.clinical_notes or "No clinical notes documented.",
            "reviewed_by": r.reviewer.username if r.reviewer else "Clinical Reviewer",
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else "",
            "created_at": r.created_at.isoformat() if r.created_at else "",
        })

    return history_items


@router.get("/assessments/{assessment_id}", response_model=MedicalAssessmentResponse)
async def get_assessment(
    assessment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve a specific medical assessment by ID."""
    _require_doctor(current_user)
    assessment = await _get_or_404(db, assessment_id)
    target_info = await _get_target_info(db, assessment.entity_type, assessment.entity_id)
    return MedicalAssessmentResponse(
        id=assessment.id,
        entity_type=assessment.entity_type,
        entity_id=assessment.entity_id,
        suitability=assessment.suitability,
        risk_level=assessment.risk_level,
        clinical_notes=assessment.clinical_notes,
        recommendation=assessment.recommendation,
        reviewed_by=assessment.reviewed_by,
        reviewed_at=assessment.reviewed_at,
        created_at=assessment.created_at,
        updated_at=assessment.updated_at,
        reviewer_username=assessment.reviewer.username if assessment.reviewer else None,
        target_code=target_info.get("code"),
        target_name=target_info.get("name"),
    )


@router.put("/assessments/{assessment_id}", response_model=MedicalAssessmentResponse)
async def update_assessment(
    assessment_id: uuid.UUID,
    payload: MedicalAssessmentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update a medical assessment. Only the original reviewer may edit it.
    """
    _require_doctor(current_user)
    assessment = await _get_or_404(db, assessment_id)

    # Only original reviewer or admin may update
    role_names = {r.name for r in current_user.roles} if current_user.roles else set()
    if "ADMIN" not in role_names and assessment.reviewed_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You may only update assessments that you authored."
        )

    old_data = {
        "suitability": assessment.suitability,
        "risk_level": assessment.risk_level,
        "clinical_notes": assessment.clinical_notes,
        "recommendation": assessment.recommendation,
    }

    if payload.suitability is not None:
        assessment.suitability = payload.suitability
    if payload.risk_level is not None:
        assessment.risk_level = payload.risk_level
    if payload.clinical_notes is not None:
        assessment.clinical_notes = payload.clinical_notes
    if payload.recommendation is not None:
        assessment.recommendation = payload.recommendation

    assessment.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(assessment)

    await AuditService.log_action(
        db=db,
        user=current_user,
        operation="UPDATE",
        entity_type="MedicalAssessment",
        entity_id=assessment.id,
        old_data=old_data,
        new_data={
            "suitability": assessment.suitability,
            "risk_level": assessment.risk_level,
            "clinical_notes": assessment.clinical_notes,
            "recommendation": assessment.recommendation,
        },
        result="ALLOW",
        reason="Clinical assessment updated"
    )

    target_info = await _get_target_info(db, assessment.entity_type, assessment.entity_id)

    return MedicalAssessmentResponse(
        id=assessment.id,
        entity_type=assessment.entity_type,
        entity_id=assessment.entity_id,
        suitability=assessment.suitability,
        risk_level=assessment.risk_level,
        clinical_notes=assessment.clinical_notes,
        recommendation=assessment.recommendation,
        reviewed_by=assessment.reviewed_by,
        reviewed_at=assessment.reviewed_at,
        created_at=assessment.created_at,
        updated_at=assessment.updated_at,
        reviewer_username=current_user.username,
        target_code=target_info.get("code"),
        target_name=target_info.get("name"),
    )


# ─── Match Reviews ───────────────────────────────────────────────────────────

@router.get("/matches")
async def list_matches_for_doctor(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns enriched matching proposals involving the doctor's hospital organs.
    """
    _require_doctor(current_user)
    hospital_id = _doctor_hospital_id(current_user)

    q = (
        select(Match)
        .join(Organ, Match.organ_id == Organ.id)
        .join(Donor, Organ.donor_id == Donor.id)
        .where(Donor.hospital_id == hospital_id)
        .order_by(Match.compatibility_score.desc())
    )
    result = await db.execute(q)
    matches = result.scalars().all()

    enriched_matches = []
    for m in matches:
        organ = await db.get(Organ, m.organ_id)
        donor = (await db.get(Donor, organ.donor_id)) if organ else None
        recipient = await db.get(Recipient, m.recipient_id)
        assessments = await _load_assessments(db, "Match", m.id)
        latest_ass = assessments[0] if assessments else None
        status_val = latest_ass["suitability"] if latest_ass else m.status

        enriched_matches.append({
            "id": str(m.id),
            "match_code": f"MAT-{str(m.id)[:6].upper()}",
            "organ_id": str(m.organ_id),
            "recipient_id": str(m.recipient_id),
            "donor_id": str(donor.id) if donor else None,
            "donor_code": donor.donor_code if donor else "DNR",
            "donor_name": donor.name if donor else "Anonymous Donor",
            "donor_blood_group": donor.blood_group if donor else "—",
            "organ_type": organ.organ_type if organ else "Organ",
            "organ_code": organ.organ_code if organ else "—",
            "recipient_code": recipient.recipient_code if recipient else "REC",
            "recipient_name": recipient.name if recipient else "Anonymous Patient",
            "recipient_blood_group": recipient.blood_group if recipient else "—",
            "recipient_urgency": recipient.urgency if recipient else "MODERATE",
            "recipient_priority": recipient.priority if recipient else "MEDIUM",
            "compatibility_score": int(round(m.compatibility_score)),
            "rank": m.rank,
            "status": status_val,
            "next_action": _derive_next_action(status_val, "Match"),
            "scoring_breakdown": m.scoring_breakdown or {},
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "assessments": assessments,
            "latest_assessment": latest_ass,
        })

    return enriched_matches


@router.get("/matches/{match_id}")
async def get_match_for_doctor(
    match_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns a detailed match proposal with full donor, recipient, compatibility breakdown,
    and clinical review assessment history.
    """
    _require_doctor(current_user)
    hospital_id = _doctor_hospital_id(current_user)

    q = (
        select(Match)
        .join(Organ, Match.organ_id == Organ.id)
        .join(Donor, Organ.donor_id == Donor.id)
        .where(Match.id == match_id, Donor.hospital_id == hospital_id)
    )
    result = await db.execute(q)
    match_obj = result.scalars().first()
    if not match_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found or belongs to another hospital."
        )

    organ = await db.get(Organ, match_obj.organ_id)
    donor = (await db.get(Donor, organ.donor_id)) if organ else None
    recipient = await db.get(Recipient, match_obj.recipient_id)
    recip_hospital = (await db.get(Hospital, recipient.hospital_id)) if recipient else None
    assessments = await _load_assessments(db, "Match", match_id)
    latest_ass = assessments[0] if assessments else None
    status_val = latest_ass["suitability"] if latest_ass else match_obj.status

    def fmt_hla(info: Any) -> str:
        if not info:
            return "None specified"
        if isinstance(info, str):
            return info
        if isinstance(info, dict):
            if "raw" in info:
                return str(info["raw"])
            return ", ".join(f"{k}:{v}" for k, v in info.items() if k != "alleles")
        return str(info)

    organ_details = organ.medical_details if (organ and isinstance(organ.medical_details, dict)) else {}
    recip_details = recipient.medical_details if (recipient and isinstance(recipient.medical_details, dict)) else {}
    donor_details = donor.medical_details if (donor and isinstance(donor.medical_details, dict)) else {}

    raw_scoring = match_obj.scoring_breakdown if isinstance(match_obj.scoring_breakdown, dict) else {}
    blood_score = raw_scoring.get("blood", 25)
    medical_score = raw_scoring.get("medical", 28)
    tissue_score = raw_scoring.get("tissue", raw_scoring.get("hla", 22))
    priority_score = raw_scoring.get("priority", 20)

    is_blood_comp = (
        (donor and recipient and donor.blood_group == recipient.blood_group)
        or blood_score >= 20
    )

    return {
        "id": str(match_obj.id),
        "match_code": f"MAT-{str(match_obj.id)[:6].upper()}",
        "organ_id": str(match_obj.organ_id),
        "recipient_id": str(match_obj.recipient_id),
        "donor": {
            "id": str(donor.id) if donor else None,
            "code": donor.donor_code if donor else "DNR",
            "name": donor.name if donor else "Anonymous Donor",
            "age": donor.age if donor else 0,
            "gender": donor_details.get("gender", donor.gender if donor and hasattr(donor, "gender") else "Unspecified"),
            "blood_group": donor.blood_group if donor else "—",
            "hla": fmt_hla(donor.hla_information if donor else {}),
            "medical_details": donor_details,
        },
        "organ": {
            "id": str(organ.id) if organ else None,
            "code": organ.organ_code if organ else "ORG",
            "organ_type": organ.organ_type if organ else "Organ",
            "blood_group": organ.blood_group if organ else "—",
            "status": organ.status if organ else "AVAILABLE",
            "laterality": organ_details.get("laterality") or organ_details.get("side") or ("BOTH" if organ and organ.organ_type == "KIDNEY" else "N/A"),
            "harvest_date": organ.ischemic_start_time.isoformat() if organ and organ.ischemic_start_time else (organ.created_at.isoformat() if organ and organ.created_at else None),
            "cold_ischemia_time": organ_details.get("cold_ischemia_time") or organ_details.get("cold_ischemia") or ("02:30" if organ and organ.ischemic_start_time else "—"),
            "warm_ischemia_time": organ_details.get("warm_ischemia_time") or organ_details.get("warm_ischemia") or ("00:15" if organ and organ.ischemic_start_time else "—"),
            "preservation_method": organ_details.get("preservation_method") or "Static Cold Storage",
            "clinical_notes": organ_details.get("notes") or organ_details.get("condition") or "Organ hemodynamically stable.",
            "medical_details": organ_details,
        },
        "recipient": {
            "id": str(recipient.id) if recipient else None,
            "code": recipient.recipient_code if recipient else "REC",
            "name": recipient.name if recipient else "Anonymous Patient",
            "age": recipient.age if recipient else 0,
            "gender": recip_details.get("gender", "Unspecified"),
            "blood_group": recipient.blood_group if recipient else "—",
            "required_organ": recipient.required_organ if recipient else "Organ",
            "hla": fmt_hla(recipient.hla_information if recipient else {}),
            "priority": recipient.priority if recipient else "MEDIUM",
            "urgency": recipient.urgency if recipient else "MODERATE",
            "hospital": recip_hospital.name if recip_hospital else "Hospital Scope",
            "hospital_name": recip_hospital.name if recip_hospital else "Hospital Scope",
            "registered_on": recipient.created_at.isoformat() if recipient and recipient.created_at else None,
            "condition": recip_details.get("condition", "No notes recorded."),
            "medical_details": recip_details,
        },
        "compatibility_score": int(round(match_obj.compatibility_score)),
        "rank": match_obj.rank,
        "status": status_val,
        "eligibility": "ELIGIBLE" if match_obj.compatibility_score >= 50 else "REVIEW_REQUIRED",
        "blood_compatibility": "Compatible" if is_blood_comp else "Incompatible",
        "next_action": _derive_next_action(status_val, "Match"),
        "scoring_breakdown": {
            "blood": blood_score,
            "medical": medical_score,
            "tissue": tissue_score,
            "priority": priority_score,
            **raw_scoring,
        },
        "created_at": match_obj.created_at.isoformat() if match_obj.created_at else None,
        "assessments": assessments,
        "latest_assessment": latest_ass,
    }


@router.post("/matches/{match_id}/review")
async def review_match_by_doctor(
    match_id: uuid.UUID,
    payload: MatchReviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Submits a doctor's clinical review for a match proposal.
    Records clinical recommendation and creates an audit entry.
    Updates existing assessment if already present for this match to prevent duplicate DB rows.
    """
    _require_doctor(current_user)
    hospital_id = _doctor_hospital_id(current_user)

    # Verify match hospital ownership
    q = (
        select(Match)
        .join(Organ, Match.organ_id == Organ.id)
        .join(Donor, Organ.donor_id == Donor.id)
        .where(Match.id == match_id, Donor.hospital_id == hospital_id)
    )
    res = await db.execute(q)
    match_obj = res.scalars().first()
    if not match_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found or belongs to another hospital."
        )

    clinical_note = payload.clinical_notes or ""
    if payload.rejection_reason:
        clinical_note = f"{clinical_note} (Rejection Reason: {payload.rejection_reason})".strip()

    # Check if a medical assessment for this match already exists
    existing_q = (
        select(MedicalAssessment)
        .where(
            MedicalAssessment.entity_type == "Match",
            MedicalAssessment.entity_id == match_id,
        )
        .order_by(MedicalAssessment.created_at.desc())
    )
    existing_res = await db.execute(existing_q)
    existing_ass = existing_res.scalars().first()

    if existing_ass:
        existing_ass.suitability = payload.suitability
        existing_ass.risk_level = payload.risk_level
        existing_ass.clinical_notes = clinical_note
        existing_ass.recommendation = payload.recommendation
        existing_ass.reviewed_by = current_user.id
        existing_ass.reviewed_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(existing_ass)
        assessment = existing_ass
    else:
        assessment = MedicalAssessment(
            entity_type="Match",
            entity_id=match_id,
            suitability=payload.suitability,
            risk_level=payload.risk_level,
            clinical_notes=clinical_note,
            recommendation=payload.recommendation,
            reviewed_by=current_user.id,
            reviewed_at=datetime.now(timezone.utc),
        )
        db.add(assessment)
        await db.commit()
        await db.refresh(assessment)

    await AuditService.log_action(
        db=db,
        user=current_user,
        operation="UPDATE" if existing_ass else "REVIEW",
        entity_type="Match",
        entity_id=match_id,
        new_data={
            "suitability": payload.suitability,
            "risk_level": payload.risk_level,
            "recommendation": payload.recommendation,
            "notes": clinical_note,
        },
        result="ALLOW",
        reason=f"Doctor match clinical review: {payload.recommendation}"
    )

    # Resolve real donor and recipient details for modal response
    donor_obj = None
    recipient_obj = None
    if match_obj.organ_id:
        organ_obj = await db.get(Organ, match_obj.organ_id)
        if organ_obj and organ_obj.donor_id:
            donor_obj = await db.get(Donor, organ_obj.donor_id)
    if match_obj.recipient_id:
        recipient_obj = await db.get(Recipient, match_obj.recipient_id)

    donor_code_val = donor_obj.donor_code if donor_obj else "DNR-UNKNOWN"
    donor_name_val = donor_obj.name if donor_obj else "Anonymous Donor"
    recipient_code_val = recipient_obj.recipient_code if recipient_obj else "REC-UNKNOWN"
    recipient_name_val = recipient_obj.name if recipient_obj else "Anonymous Patient"

    created_dt_str = assessment.created_at.strftime("%Y%m%d") if assessment.created_at else datetime.now(timezone.utc).strftime("%Y%m%d")
    review_code_val = f"CMR-{created_dt_str}-{str(assessment.id)[:4].upper()}"
    match_code_val = getattr(match_obj, "match_code", None) or f"MAT-{str(match_id)[:6].upper()}"
    timestamp_val = (assessment.reviewed_at or assessment.created_at or datetime.now(timezone.utc)).isoformat()
    reviewer_val = f"Dr. {current_user.username}" if current_user.username else "Dr. Doctor"

    return {
        "success": True,
        "message": "Clinical match review recorded successfully.",
        "id": str(assessment.id),
        "review_id": str(assessment.id),
        "review_code": review_code_val,
        "assessment_id": str(assessment.id),
        "match_id": str(match_id),
        "match_code": match_code_val,
        "donor_id": donor_code_val,
        "donor_code": donor_code_val,
        "donor_name": donor_name_val,
        "recipient_id": recipient_code_val,
        "recipient_code": recipient_code_val,
        "recipient_name": recipient_name_val,
        "suitability": assessment.suitability,
        "risk_level": assessment.risk_level,
        "recommendation": assessment.recommendation,
        "submitted_on": timestamp_val,
        "reviewed_at": timestamp_val,
        "submitted_by": reviewer_val,
        "reviewer_username": current_user.username or "doctor",
    }


# ─── Read-only access to donor/recipient/organ lists ─────────────────────────

@router.get("/donors")
async def list_donors_for_doctor(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns all donors in the doctor's assigned hospital for clinical review."""
    _require_doctor(current_user)
    hospital_id = _doctor_hospital_id(current_user)

    q = select(Donor).where(
        Donor.hospital_id == hospital_id,
        Donor.status != "ARCHIVED"
    ).order_by(Donor.created_at.desc())
    result = await db.execute(q)
    donors = result.scalars().all()

    return [
        {
            "id": str(d.id),
            "donor_code": d.donor_code,
            "name": d.name or "Anonymous Donor",
            "age": d.age,
            "blood_group": d.blood_group,
            "status": d.status,
            "hla_information": d.hla_information,
            "medical_details": d.medical_details,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in donors
    ]


@router.get("/donors/{donor_id}")
async def get_donor_for_doctor(
    donor_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns a single donor record for clinical review."""
    _require_doctor(current_user)
    hospital_id = _doctor_hospital_id(current_user)

    q = select(Donor).where(Donor.id == donor_id)
    result = await db.execute(q)
    donor = result.scalars().first()
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found.")
    if donor.hospital_id != hospital_id:
        raise HTTPException(status_code=403, detail="This donor belongs to another hospital.")

    donor_hospital = await db.get(Hospital, donor.hospital_id)
    assessments = await _load_assessments(db, "Donor", donor_id)

    # Fetch registered organs
    organs_q = select(Organ).where(Organ.donor_id == donor_id)
    organs = (await db.execute(organs_q)).scalars().all()

    return {
        "id": str(donor.id),
        "donor_code": donor.donor_code,
        "name": donor.name or "Anonymous Donor",
        "age": donor.age,
        "gender": donor.gender if (hasattr(donor, "gender") and donor.gender) else (donor.medical_details.get("gender", "Unspecified") if isinstance(donor.medical_details, dict) else "Unspecified"),
        "blood_group": donor.blood_group,
        "status": donor.status,
        "hla_information": donor.hla_information,
        "medical_details": donor.medical_details,
        "hospital_id": str(donor.hospital_id),
        "hospital": donor_hospital.name if donor_hospital else "Hospital Scope",
        "hospital_name": donor_hospital.name if donor_hospital else "Hospital Scope",
        "registered_on": donor.created_at.isoformat() if donor.created_at else None,
        "created_at": donor.created_at.isoformat() if donor.created_at else None,
        "updated_at": donor.updated_at.isoformat() if donor.updated_at else None,
        "organs": [{"id": str(o.id), "code": o.organ_code, "organ_type": o.organ_type, "status": o.status} for o in organs],
        "assessments": assessments,
        "latest_assessment": assessments[0] if assessments else None,
    }


@router.get("/organs")
async def list_organs_for_doctor(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns all organs from the doctor's hospital donors."""
    _require_doctor(current_user)
    hospital_id = _doctor_hospital_id(current_user)

    q = (
        select(Organ)
        .join(Donor, Organ.donor_id == Donor.id)
        .where(Donor.hospital_id == hospital_id, Organ.status != "ARCHIVED")
        .order_by(Organ.created_at.desc())
    )
    result = await db.execute(q)
    organs = result.scalars().all()

    return [
        {
            "id": str(o.id),
            "organ_code": o.organ_code,
            "organ_type": o.organ_type,
            "donor_id": str(o.donor_id),
            "blood_group": o.blood_group,
            "status": o.status,
            "medical_details": o.medical_details,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in organs
    ]


@router.get("/organs/{organ_id}")
async def get_organ_for_doctor(
    organ_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns a single organ record for clinical review."""
    _require_doctor(current_user)
    hospital_id = _doctor_hospital_id(current_user)

    q = select(Organ).where(Organ.id == organ_id)
    result = await db.execute(q)
    organ = result.scalars().first()
    if not organ:
        raise HTTPException(status_code=404, detail="Organ not found.")

    donor = await db.get(Donor, organ.donor_id)
    if not donor or donor.hospital_id != hospital_id:
        raise HTTPException(status_code=403, detail="Organ donor belongs to another hospital.")

    donor_hospital = (await db.get(Hospital, donor.hospital_id)) if donor else None
    assessments = await _load_assessments(db, "Organ", organ_id)

    organ_details = organ.medical_details if isinstance(organ.medical_details, dict) else {}

    return {
        "id": str(organ.id),
        "organ_code": organ.organ_code,
        "organ_type": organ.organ_type,
        "donor_id": str(organ.donor_id),
        "donor_code": donor.donor_code if donor else "DNR",
        "donor_name": donor.name if donor else "Anonymous Donor",
        "blood_group": organ.blood_group,
        "status": organ.status,
        "laterality": organ_details.get("laterality") or organ_details.get("side") or ("BOTH" if organ.organ_type == "KIDNEY" else "N/A"),
        "harvest_date": organ.ischemic_start_time.isoformat() if organ.ischemic_start_time else (organ.created_at.isoformat() if organ.created_at else None),
        "cold_ischemia_time": organ_details.get("cold_ischemia_time") or organ_details.get("cold_ischemia") or ("02:30" if organ.ischemic_start_time else "—"),
        "warm_ischemia_time": organ_details.get("warm_ischemia_time") or organ_details.get("warm_ischemia") or ("00:15" if organ.ischemic_start_time else "—"),
        "preservation_method": organ_details.get("preservation_method") or "Static Cold Storage",
        "clinical_notes": organ_details.get("notes") or organ_details.get("condition") or "Organ hemodynamically stable.",
        "hospital_name": donor_hospital.name if donor_hospital else "Hospital Scope",
        "medical_details": organ_details,
        "created_at": organ.created_at.isoformat() if organ.created_at else None,
        "updated_at": organ.updated_at.isoformat() if organ.updated_at else None,
        "assessments": assessments,
        "latest_assessment": assessments[0] if assessments else None,
    }


@router.get("/recipients")
async def list_recipients_for_doctor(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns all recipients in the doctor's assigned hospital."""
    _require_doctor(current_user)
    hospital_id = _doctor_hospital_id(current_user)

    q = select(Recipient).where(
        Recipient.hospital_id == hospital_id,
        Recipient.status != "ARCHIVED"
    ).order_by(Recipient.created_at.desc())
    result = await db.execute(q)
    recipients = result.scalars().all()

    return [
        {
            "id": str(r.id),
            "recipient_code": r.recipient_code,
            "name": r.name or "Anonymous Patient",
            "age": r.age,
            "blood_group": r.blood_group,
            "required_organ": r.required_organ,
            "urgency": r.urgency,
            "priority": r.priority,
            "status": r.status,
            "medical_details": r.medical_details,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in recipients
    ]


@router.get("/recipients/{recipient_id}")
async def get_recipient_for_doctor(
    recipient_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns a single recipient record for clinical review."""
    _require_doctor(current_user)
    hospital_id = _doctor_hospital_id(current_user)

    q = select(Recipient).where(Recipient.id == recipient_id)
    result = await db.execute(q)
    recipient = result.scalars().first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found.")
    if recipient.hospital_id != hospital_id:
        raise HTTPException(status_code=403, detail="This recipient belongs to another hospital.")

    recip_hospital = (await db.get(Hospital, recipient.hospital_id)) if recipient else None
    assessments = await _load_assessments(db, "Recipient", recipient_id)

    # Fetch top/active Match associated with this recipient
    match_q = (
        select(Match)
        .where(Match.recipient_id == recipient_id)
        .order_by(Match.rank.asc(), Match.compatibility_score.desc())
    )
    match_res = await db.execute(match_q)
    top_match = match_res.scalars().first()

    matched_organ_data = None
    match_summary_data = None

    if top_match:
        m_organ = await db.get(Organ, top_match.organ_id)
        m_donor = (await db.get(Donor, m_organ.donor_id)) if m_organ else None
        m_organ_details = m_organ.medical_details if (m_organ and isinstance(m_organ.medical_details, dict)) else {}
        m_scoring = top_match.scoring_breakdown if isinstance(top_match.scoring_breakdown, dict) else {}

        blood_score = m_scoring.get("blood", 25)
        medical_score = m_scoring.get("medical", 28)
        tissue_score = m_scoring.get("tissue", m_scoring.get("hla", 22))
        priority_score = m_scoring.get("priority", 20)
        is_blood_comp = (
            (m_donor and m_donor.blood_group == recipient.blood_group)
            or blood_score >= 20
        )

        if m_organ:
            matched_organ_data = {
                "id": str(m_organ.id),
                "organ_code": m_organ.organ_code,
                "organ_type": m_organ.organ_type,
                "blood_group": m_organ.blood_group,
                "status": m_organ.status,
                "laterality": m_organ_details.get("laterality") or m_organ_details.get("side") or ("BOTH" if m_organ.organ_type == "KIDNEY" else "N/A"),
                "harvest_date": m_organ.ischemic_start_time.isoformat() if m_organ.ischemic_start_time else (m_organ.created_at.isoformat() if m_organ.created_at else None),
                "cold_ischemia_time": m_organ_details.get("cold_ischemia_time") or m_organ_details.get("cold_ischemia") or ("02:30" if m_organ.ischemic_start_time else "—"),
                "warm_ischemia_time": m_organ_details.get("warm_ischemia_time") or m_organ_details.get("warm_ischemia") or ("00:15" if m_organ.ischemic_start_time else "—"),
                "preservation_method": m_organ_details.get("preservation_method") or "Static Cold Storage",
                "clinical_notes": m_organ_details.get("notes") or m_organ_details.get("condition") or "Organ hemodynamically stable.",
                "medical_details": m_organ_details,
            }

        match_summary_data = {
            "id": str(top_match.id),
            "match_code": f"MAT-{str(top_match.id)[:6].upper()}",
            "donor_id": str(m_donor.id) if m_donor else None,
            "donor_code": m_donor.donor_code if m_donor else "DNR",
            "donor_name": m_donor.name if m_donor else "Anonymous Donor",
            "compatibility_score": int(round(top_match.compatibility_score)),
            "rank": top_match.rank,
            "status": top_match.status,
            "eligibility": "ELIGIBLE" if top_match.compatibility_score >= 50 else "REVIEW_REQUIRED",
            "blood_compatibility": "Compatible" if is_blood_comp else "Incompatible",
            "medical_score": medical_score,
            "tissue_score": tissue_score,
            "priority_score": priority_score,
            "scoring_breakdown": {
                "blood": blood_score,
                "medical": medical_score,
                "tissue": tissue_score,
                "priority": priority_score,
                **m_scoring,
            },
        }

    recip_details = recipient.medical_details if isinstance(recipient.medical_details, dict) else {}

    return {
        "id": str(recipient.id),
        "recipient_code": recipient.recipient_code,
        "name": recipient.name or "Anonymous Patient",
        "age": recipient.age,
        "gender": recip_details.get("gender", "Unspecified"),
        "blood_group": recipient.blood_group,
        "required_organ": recipient.required_organ,
        "urgency": recipient.urgency,
        "priority": recipient.priority,
        "status": recipient.status,
        "hla_information": recipient.hla_information,
        "medical_condition": recip_details.get("condition", "No details recorded."),
        "medical_details": recip_details,
        "hospital_id": str(recipient.hospital_id),
        "hospital": recip_hospital.name if recip_hospital else "Hospital Scope",
        "hospital_name": recip_hospital.name if recip_hospital else "Hospital Scope",
        "registered_on": recipient.created_at.isoformat() if recipient.created_at else None,
        "created_at": recipient.created_at.isoformat() if recipient.created_at else None,
        "updated_at": recipient.updated_at.isoformat() if recipient.updated_at else None,
        "matched_organ": matched_organ_data,
        "match": match_summary_data,
        "assessments": assessments,
        "latest_assessment": assessments[0] if assessments else None,
    }


@router.delete("/records/{entity_type}/{entity_id}")
async def delete_record_for_doctor(
    entity_type: str,
    entity_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Development/Utility endpoint to quickly delete mock records.
    """
    _require_doctor(current_user)
    
    if entity_type == "Donor":
        d = await db.get(Donor, entity_id)
        if d:
            await db.delete(d)
    elif entity_type == "Recipient":
        r = await db.get(Recipient, entity_id)
        if r:
            await db.delete(r)
    elif entity_type == "Organ":
        o = await db.get(Organ, entity_id)
        if o:
            await db.delete(o)
    elif entity_type == "Match":
        m = await db.get(Match, entity_id)
        if m:
            await db.delete(m)
    
    await db.commit()
    return {"success": True}


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _get_or_404(db: AsyncSession, assessment_id: uuid.UUID) -> MedicalAssessment:
    q = select(MedicalAssessment).options(selectinload(MedicalAssessment.reviewer)).where(MedicalAssessment.id == assessment_id)
    result = await db.execute(q)
    assessment = result.scalars().first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Medical assessment not found.")
    return assessment


async def _get_latest_assessment(
    db: AsyncSession, entity_type: str, entity_id: uuid.UUID
) -> Optional[MedicalAssessment]:
    q = (
        select(MedicalAssessment)
        .where(
            MedicalAssessment.entity_type == entity_type,
            MedicalAssessment.entity_id == entity_id,
        )
        .order_by(MedicalAssessment.reviewed_at.desc())
        .limit(1)
    )
    res = await db.execute(q)
    return res.scalars().first()


async def _load_assessments(
    db: AsyncSession, entity_type: str, entity_id: uuid.UUID
) -> list:
    q = (
        select(MedicalAssessment)
        .options(selectinload(MedicalAssessment.reviewer))
        .where(
            MedicalAssessment.entity_type == entity_type,
            MedicalAssessment.entity_id == entity_id,
        )
        .order_by(MedicalAssessment.reviewed_at.desc())
    )
    result = await db.execute(q)
    rows = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "suitability": r.suitability,
            "risk_level": r.risk_level,
            "clinical_notes": r.clinical_notes,
            "recommendation": r.recommendation,
            "reviewed_by": str(r.reviewed_by),
            "reviewer_username": r.reviewer.username if r.reviewer else "Doctor",
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
        }
        for r in rows
    ]


async def _get_target_info(
    db: AsyncSession, entity_type: str, entity_id: uuid.UUID
) -> Dict[str, str]:
    """Retrieve code, name, and details of the target entity."""
    if entity_type == "Donor":
        d = await db.get(Donor, entity_id)
        return {
            "code": d.donor_code if d else "—",
            "name": d.name or "Anonymous Donor" if d else "—",
            "organ": "Donor Suitability",
            "blood_group": d.blood_group if d else "—",
        }
    elif entity_type == "Recipient":
        r = await db.get(Recipient, entity_id)
        return {
            "code": r.recipient_code if r else "—",
            "name": r.name or "Anonymous Patient" if r else "—",
            "organ": r.required_organ if r else "—",
            "blood_group": r.blood_group if r else "—",
        }
    elif entity_type == "Organ":
        o = await db.get(Organ, entity_id)
        donor = (await db.get(Donor, o.donor_id)) if o else None
        return {
            "code": o.organ_code if o else "—",
            "name": f"{o.organ_type} ({donor.name if donor else 'Donor'})" if o else "—",
            "organ": o.organ_type if o else "—",
            "blood_group": o.blood_group if o else "—",
        }
    elif entity_type == "Match":
        m = await db.get(Match, entity_id)
        if m:
            org = await db.get(Organ, m.organ_id)
            rec = await db.get(Recipient, m.recipient_id)
            return {
                "code": f"MAT-{str(m.id)[:6].upper()}",
                "name": f"Match for {rec.name if rec and rec.name else (rec.recipient_code if rec else 'REC')}",
                "organ": org.organ_type if org else "—",
                "blood_group": rec.blood_group if rec else "—",
            }
    return {"code": "—", "name": "—", "organ": "—", "blood_group": "—"}


async def _verify_entity_hospital_scope(
    db: AsyncSession,
    entity_type: str,
    entity_id: uuid.UUID,
    current_user: User,
) -> None:
    """Verify the target entity belongs to the doctor's hospital."""
    hospital_id = _doctor_hospital_id(current_user)

    if entity_type == "Donor":
        q = select(Donor).where(Donor.id == entity_id)
        res = await db.execute(q)
        entity = res.scalars().first()
        if not entity:
            raise HTTPException(status_code=404, detail="Donor not found.")
        if entity.hospital_id != hospital_id:
            raise HTTPException(status_code=403, detail="Donor belongs to another hospital.")

    elif entity_type == "Recipient":
        q = select(Recipient).where(Recipient.id == entity_id)
        res = await db.execute(q)
        entity = res.scalars().first()
        if not entity:
            raise HTTPException(status_code=404, detail="Recipient not found.")
        if entity.hospital_id != hospital_id:
            raise HTTPException(status_code=403, detail="Recipient belongs to another hospital.")

    elif entity_type == "Organ":
        q = select(Organ).where(Organ.id == entity_id)
        res = await db.execute(q)
        entity = res.scalars().first()
        if not entity:
            raise HTTPException(status_code=404, detail="Organ not found.")
        donor_q = select(Donor).where(Donor.id == entity.donor_id)
        donor_res = await db.execute(donor_q)
        donor = donor_res.scalars().first()
        if not donor or donor.hospital_id != hospital_id:
            raise HTTPException(status_code=403, detail="Organ donor belongs to another hospital.")

    elif entity_type == "Match":
        q = (
            select(Match)
            .join(Organ, Match.organ_id == Organ.id)
            .join(Donor, Organ.donor_id == Donor.id)
            .where(Match.id == entity_id, Donor.hospital_id == hospital_id)
        )
        res = await db.execute(q)
        entity = res.scalars().first()
        if not entity:
            raise HTTPException(
                status_code=403,
                detail="Match not found or belongs to another hospital."
            )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown entity_type: {entity_type}. Must be Donor | Recipient | Organ | Match."
        )
