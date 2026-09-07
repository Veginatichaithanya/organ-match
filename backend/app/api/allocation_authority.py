import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func

from app.database.session import get_db
from app.models.user import User
from app.models.organ import Organ
from app.models.donor import Donor
from app.models.recipient import Recipient
from app.models.match import Match
from app.models.allocation import Allocation
from app.models.medical_assessment import MedicalAssessment

from app.security.authentication import get_current_user

router = APIRouter(prefix="/allocation", tags=["Allocation Authority"])


def _require_allocation_authority_or_admin(current_user: User) -> User:
    role_name = current_user.roles[0].name if current_user.roles else "guest"
    if role_name not in ["ALLOCATION_AUTHORITY", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the Allocation Authority role may access this endpoint."
        )
    return current_user


def _compute_score_pct(score: Optional[float]) -> int:
    if score is None:
        return 0
    if score <= 1.0:
        return round(score * 100)
    return round(score)


def _extract_breakdown(scoring_breakdown: Optional[dict]) -> dict:
    """
    Extract real scoring breakdown from the match's scoring_breakdown JSON column.
    Returns sensible defaults when fields are missing — does NOT invent values.
    """
    if not scoring_breakdown or not isinstance(scoring_breakdown, dict):
        return {
            "blood_score": None,
            "medical_score": None,
            "tissue_score": None,
            "priority_score": None,
            "explanation": None,
        }
    return {
        "blood_score": scoring_breakdown.get("blood_compatibility_score")
            or scoring_breakdown.get("blood_score"),
        "medical_score": scoring_breakdown.get("medical_score")
            or scoring_breakdown.get("age_score"),
        "tissue_score": scoring_breakdown.get("hla_score")
            or scoring_breakdown.get("tissue_score"),
        "priority_score": scoring_breakdown.get("priority_score")
            or scoring_breakdown.get("urgency_score"),
        "explanation": scoring_breakdown.get("reason")
            or scoring_breakdown.get("explanation"),
    }


async def _get_clinical_status_for_entities(
    db: AsyncSession,
    entity_ids: List[uuid.UUID],
) -> Optional[MedicalAssessment]:
    """
    Return the most recent MedicalAssessment for any of the given entity IDs.
    Entity types searched: Match, Organ, Recipient.
    """
    if not entity_ids:
        return None
    doc_q = (
        select(MedicalAssessment)
        .options(selectinload(MedicalAssessment.reviewer))
        .where(
            MedicalAssessment.entity_type.in_(["Match", "Organ", "Recipient"]),
            MedicalAssessment.entity_id.in_(entity_ids),
        )
        .order_by(MedicalAssessment.created_at.desc())
    )
    res = await db.execute(doc_q)
    return res.scalars().first()


@router.get("/overview")
async def allocation_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_allocation_authority_or_admin(current_user)

    # 1. Available Organs count
    organs_q = select(func.count(Organ.id)).where(Organ.status == "AVAILABLE")
    organs_available = (await db.execute(organs_q)).scalar() or 0

    # 2. Pending Allocation Reviews (actual PENDING allocations)
    alloc_pending_q = select(func.count(Allocation.id)).where(Allocation.status == "PENDING")
    alloc_pending = (await db.execute(alloc_pending_q)).scalar() or 0

    # 3. Pending Matches (matches in PENDING/SELECTED that may need allocation creation)
    matches_q = select(func.count(Match.id)).where(Match.status.in_(["PENDING", "SELECTED"]))
    matches_pending = (await db.execute(matches_q)).scalar() or 0

    # 4. High Priority Recipients (ACTIVE, urgency HIGH or CRITICAL)
    high_prio_q = select(func.count(Recipient.id)).where(
        Recipient.status == "ACTIVE",
        Recipient.urgency.in_(["HIGH", "CRITICAL"]),
    )
    high_priority = (await db.execute(high_prio_q)).scalar() or 0

    # 5. Approved Allocations count (all terminal-approved statuses)
    approved_statuses = ["DATABASE_COMMITTED", "FABRIC_SUBMITTED", "FABRIC_CONFIRMED", "APPROVED"]
    approved_q = select(func.count(Allocation.id)).where(
        Allocation.status.in_(approved_statuses)
    )
    approved_count = (await db.execute(approved_q)).scalar() or 0

    # 6. Rejected Allocations count
    rejected_q = select(func.count(Allocation.id)).where(Allocation.status == "REJECTED")
    rejected_count = (await db.execute(rejected_q)).scalar() or 0

    # 7. Clinically approved matches awaiting allocation decision
    # These are PENDING matches that have an APPROVED MedicalAssessment
    pending_match_ids_q = select(Match.id).where(Match.status == "PENDING")
    pending_match_ids_res = await db.execute(pending_match_ids_q)
    pending_match_ids = [row[0] for row in pending_match_ids_res.fetchall()]

    clinically_approved_count = 0
    if pending_match_ids:
        approved_ma_q = select(func.count(MedicalAssessment.id)).where(
            MedicalAssessment.entity_type == "Match",
            MedicalAssessment.entity_id.in_(pending_match_ids),
            MedicalAssessment.suitability == "APPROVED",
        )
        clinically_approved_count = (await db.execute(approved_ma_q)).scalar() or 0

    # 8. Recent Allocation Decisions (last 10)
    recent_q = (
        select(Allocation)
        .options(
            selectinload(Allocation.organ),
            selectinload(Allocation.recipient),
            selectinload(Allocation.approver),
        )
        .order_by(Allocation.updated_at.desc())
        .limit(10)
    )
    recent_res = await db.execute(recent_q)
    recent_allocs = recent_res.scalars().all()

    recent_decisions = [
        {
            "id": str(a.id),
            "organ_type": a.organ.organ_type if a.organ else "UNKNOWN",
            "recipient_name": a.recipient.name if a.recipient else "UNKNOWN",
            "status": a.status,
            "approved_by": a.approver.username if a.approver else None,
            "rejection_reason": a.rejection_reason,
            "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        }
        for a in recent_allocs
    ]

    return {
        "organs_available": organs_available,
        "pending_allocation_reviews": alloc_pending,
        "medically_approved_matches": matches_pending,
        "clinically_approved_awaiting_allocation": clinically_approved_count,
        "high_priority_recipients": high_priority,
        "approved_allocations": approved_count,
        "rejected_allocations": rejected_count,
        "allocations_completed": approved_count + rejected_count,
        "recent_decisions": recent_decisions,
    }


@router.get("/organs")
async def list_available_organs_for_authority(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_allocation_authority_or_admin(current_user)
    q = (
        select(Organ)
        .options(
            selectinload(Organ.donor).selectinload(Donor.hospital)
        )
        .where(Organ.status != "ARCHIVED")
        .order_by(Organ.created_at.desc())
    )
    res = await db.execute(q)
    organs = res.scalars().all()

    return [
        {
            "id": str(o.id),
            "organ_code": o.organ_code,  # Use actual organ_code, not computed
            "organ_type": o.organ_type,
            "blood_group": o.blood_group,
            "donor_id": str(o.donor_id),
            "donor_code": o.donor.donor_code if o.donor else "UNKNOWN",
            "donor_name": o.donor.name if o.donor else None,
            "donor_blood_group": o.donor.blood_group if o.donor else None,
            "hospital_name": o.donor.hospital.name if o.donor and o.donor.hospital else None,
            "laterality": (o.medical_details or {}).get("laterality"),
            "ischemic_start_time": o.ischemic_start_time.isoformat() if o.ischemic_start_time else None,
            "max_ischemic_hours": o.max_ischemic_hours,
            "status": o.status,
            "is_allocatable": o.status in ["AVAILABLE", "RESERVED"],
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in organs
    ]


@router.get("/matches")
async def list_matches_for_authority(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_allocation_authority_or_admin(current_user)
    q = (
        select(Match)
        .options(
            selectinload(Match.organ).selectinload(Organ.donor),
            selectinload(Match.recipient),
            selectinload(Match.allocation),
        )
        .order_by(Match.compatibility_score.desc())
    )
    res = await db.execute(q)
    matches = res.scalars().all()

    results = []
    for m in matches:
        # Load the most recent clinical assessment for this match
        latest_assessment = await _get_clinical_status_for_entities(
            db, [m.id, m.organ_id, m.recipient_id]
        )

        # Load reviewer name if assessment exists
        reviewer_name = None
        if latest_assessment and latest_assessment.reviewer:
            reviewer_name = latest_assessment.reviewer.username
        elif latest_assessment:
            # Load reviewer separately
            reviewer_q = select(User).where(User.id == latest_assessment.reviewed_by)
            reviewer_res = await db.execute(reviewer_q)
            reviewer_obj = reviewer_res.scalars().first()
            reviewer_name = reviewer_obj.username if reviewer_obj else None

        score_pct = _compute_score_pct(m.compatibility_score)

        results.append({
            "id": str(m.id),
            "rank": m.rank or 1,
            "organ_id": str(m.organ_id),
            "organ_code": m.organ.organ_code if m.organ else f"ORG-{str(m.organ_id)[:6].upper()}",
            "organ_type": m.organ.organ_type if m.organ else "UNKNOWN",
            "organ_blood_group": m.organ.blood_group if m.organ else None,
            "donor_id": str(m.organ.donor_id) if m.organ else None,
            "donor_name": m.organ.donor.name if m.organ and m.organ.donor else None,
            "donor_code": m.organ.donor.donor_code if m.organ and m.organ.donor else None,
            "recipient_id": str(m.recipient_id),
            "recipient_code": m.recipient.recipient_code if m.recipient else "UNKNOWN",
            "recipient_name": m.recipient.name if m.recipient else "UNKNOWN",
            "recipient_blood_group": m.recipient.blood_group if m.recipient else None,
            "required_organ": m.recipient.required_organ if m.recipient else None,
            "compatibility_score": m.compatibility_score,
            "compatibility_score_pct": score_pct,
            "eligibility": (
                "ELIGIBLE"
                if m.organ and m.recipient and m.organ.blood_group == m.recipient.blood_group
                else "NEEDS_EVALUATION"
            ),
            "clinical_assessment_status": latest_assessment.suitability if latest_assessment else None,
            "clinical_risk_level": latest_assessment.risk_level if latest_assessment else None,
            "clinical_reviewer": reviewer_name,
            "clinical_notes": latest_assessment.clinical_notes if latest_assessment else None,
            "clinical_recommendation": latest_assessment.recommendation if latest_assessment else None,
            "clinical_reviewed_at": (
                latest_assessment.reviewed_at.isoformat()
                if latest_assessment and latest_assessment.reviewed_at
                else None
            ),
            "priority": m.recipient.priority if m.recipient else "MEDIUM",
            "urgency": m.recipient.urgency if m.recipient else "MODERATE",
            "status": (
                "APPROVED"
                if (m.status == "ACCEPTED" or (m.allocation and m.allocation.status in ["DATABASE_COMMITTED", "FABRIC_SUBMITTED", "FABRIC_CONFIRMED", "APPROVED"]))
                else "REJECTED"
                if (m.status == "REJECTED" or (m.allocation and m.allocation.status == "REJECTED"))
                else m.status
            ),
            # Allocation linkage — if an allocation exists for this match
            "allocation_id": str(m.allocation.id) if m.allocation else None,
            "allocation_status": m.allocation.status if m.allocation else None,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        })
    return results


@router.get("/matches/{match_id}")
async def get_match_detail_for_authority(
    match_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_allocation_authority_or_admin(current_user)
    q = (
        select(Match)
        .where(Match.id == match_id)
        .options(
            selectinload(Match.organ).selectinload(Organ.donor).selectinload(Donor.hospital),
            selectinload(Match.recipient),
            selectinload(Match.allocation),
        )
    )
    res = await db.execute(q)
    match_obj = res.scalars().first()
    if not match_obj:
        raise HTTPException(status_code=404, detail="Match record not found.")

    # Doctor/clinical assessments (all for this match entity)
    doc_q = (
        select(MedicalAssessment)
        .options(selectinload(MedicalAssessment.reviewer))
        .where(
            MedicalAssessment.entity_type.in_(["Match", "Organ", "Recipient"]),
            MedicalAssessment.entity_id.in_(
                [match_obj.id, match_obj.organ_id, match_obj.recipient_id]
            ),
        )
        .order_by(MedicalAssessment.created_at.desc())
    )
    doc_res = await db.execute(doc_q)
    doc_assessments = doc_res.scalars().all()
    latest_doc = doc_assessments[0] if doc_assessments else None

    # Extract REAL scoring breakdown from match JSON column
    breakdown = _extract_breakdown(
        match_obj.scoring_breakdown if isinstance(match_obj.scoring_breakdown, dict) else {}
    )
    score_pct = _compute_score_pct(match_obj.compatibility_score)

    # Build explanation from real data
    if breakdown["explanation"]:
        explanation = breakdown["explanation"]
    else:
        explanation = (
            f"Recipient ranked #{match_obj.rank or 1} with {score_pct}% compatibility score. "
            f"Blood group: {match_obj.organ.blood_group if match_obj.organ else 'N/A'} → "
            f"{match_obj.recipient.blood_group if match_obj.recipient else 'N/A'}. "
            f"Priority: {match_obj.recipient.priority if match_obj.recipient else 'N/A'}, "
            f"Urgency: {match_obj.recipient.urgency if match_obj.recipient else 'N/A'}."
        )

    return {
        "id": str(match_obj.id),
        # Organ details
        "organ_id": str(match_obj.organ_id),
        "organ_code": match_obj.organ.organ_code if match_obj.organ else f"ORG-{str(match_obj.organ_id)[:6].upper()}",
        "organ_type": match_obj.organ.organ_type if match_obj.organ else "UNKNOWN",
        "organ_blood": match_obj.organ.blood_group if match_obj.organ else None,
        "organ_status": match_obj.organ.status if match_obj.organ else None,
        "ischemic_start_time": (
            match_obj.organ.ischemic_start_time.isoformat()
            if match_obj.organ and match_obj.organ.ischemic_start_time
            else None
        ),
        "max_ischemic_hours": match_obj.organ.max_ischemic_hours if match_obj.organ else None,
        "laterality": (match_obj.organ.medical_details or {}).get("laterality") if match_obj.organ else None,
        # Donor details
        "donor_id": str(match_obj.organ.donor_id) if match_obj.organ else None,
        "donor_name": match_obj.organ.donor.name if match_obj.organ and match_obj.organ.donor else None,
        "donor_code": match_obj.organ.donor.donor_code if match_obj.organ and match_obj.organ.donor else None,
        "donor_blood_group": match_obj.organ.donor.blood_group if match_obj.organ and match_obj.organ.donor else None,
        "donor_hospital": (
            match_obj.organ.donor.hospital.name
            if match_obj.organ and match_obj.organ.donor and match_obj.organ.donor.hospital
            else None
        ),
        # Recipient details
        "recipient_id": str(match_obj.recipient_id),
        "recipient_code": match_obj.recipient.recipient_code if match_obj.recipient else "UNKNOWN",
        "recipient_name": match_obj.recipient.name if match_obj.recipient else "UNKNOWN",
        "recipient_blood": match_obj.recipient.blood_group if match_obj.recipient else None,
        "required_organ": match_obj.recipient.required_organ if match_obj.recipient else None,
        "recipient_priority": match_obj.recipient.priority if match_obj.recipient else "MEDIUM",
        "recipient_urgency": match_obj.recipient.urgency if match_obj.recipient else "MODERATE",
        # Matching scores — from real scoring_breakdown JSON
        "compatibility_score": match_obj.compatibility_score,
        "compatibility_score_pct": score_pct,
        "blood_score": breakdown["blood_score"],
        "medical_score": breakdown["medical_score"],
        "tissue_score": breakdown["tissue_score"],
        "priority_score": breakdown["priority_score"],
        "rank": match_obj.rank or 1,
        "matching_explanation": explanation,
        "scoring_breakdown_raw": match_obj.scoring_breakdown,
        # Clinical/doctor assessment (READ-ONLY for Allocation Authority)
        "doctor_assessment": {
            "suitability": latest_doc.suitability if latest_doc else None,
            "risk_level": latest_doc.risk_level if latest_doc else None,
            "recommendation": latest_doc.recommendation if latest_doc else None,
            "clinical_notes": latest_doc.clinical_notes if latest_doc else None,
            "reviewer": latest_doc.reviewer.username if latest_doc and latest_doc.reviewer else None,
            "reviewed_at": (
                latest_doc.reviewed_at.isoformat()
                if latest_doc and latest_doc.reviewed_at
                else None
            ),
        },
        # All assessments for comprehensive view
        "all_assessments": [
            {
                "id": str(a.id),
                "entity_type": a.entity_type,
                "suitability": a.suitability,
                "risk_level": a.risk_level,
                "recommendation": a.recommendation,
                "clinical_notes": a.clinical_notes,
                "reviewer": a.reviewer.username if a.reviewer else None,
                "reviewed_at": a.reviewed_at.isoformat() if a.reviewed_at else None,
            }
            for a in doc_assessments
        ],
        # Match status
        "status": (
            "APPROVED"
            if (match_obj.status == "ACCEPTED" or (match_obj.allocation and match_obj.allocation.status in ["DATABASE_COMMITTED", "FABRIC_SUBMITTED", "FABRIC_CONFIRMED", "APPROVED"]))
            else "REJECTED"
            if (match_obj.status == "REJECTED" or (match_obj.allocation and match_obj.allocation.status == "REJECTED"))
            else match_obj.status
        ),
        # Allocation linkage
        "allocation_id": str(match_obj.allocation.id) if match_obj.allocation else None,
        "allocation_status": match_obj.allocation.status if match_obj.allocation else None,
        "created_at": match_obj.created_at.isoformat() if match_obj.created_at else None,
    }


@router.get("/queue")
async def list_allocation_queue(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_allocation_authority_or_admin(current_user)
    q = (
        select(Allocation)
        .options(
            selectinload(Allocation.organ).selectinload(Organ.donor).selectinload(Donor.hospital),
            selectinload(Allocation.recipient),
            selectinload(Allocation.match),
            selectinload(Allocation.approver),
        )
        .order_by(Allocation.created_at.desc())
    )
    res = await db.execute(q)
    allocs = res.scalars().all()

    results = []
    for a in allocs:
        # Query actual clinical assessment status for this allocation
        entity_ids = [
            eid for eid in [a.match_id, a.organ_id, a.recipient_id] if eid is not None
        ]
        latest_assessment = await _get_clinical_status_for_entities(db, entity_ids)

        score_pct = _compute_score_pct(a.match.compatibility_score if a.match else None)

        results.append({
            "id": str(a.id),
            "match_id": str(a.match_id),
            # Organ
            "organ_id": str(a.organ_id),
            "organ_code": a.organ.organ_code if a.organ else f"ORG-{str(a.organ_id)[:6].upper()}",
            "organ_type": a.organ.organ_type if a.organ else "UNKNOWN",
            "organ_blood_group": a.organ.blood_group if a.organ else None,
            "organ_status": a.organ.status if a.organ else None,
            # Donor
            "donor_id": str(a.organ.donor_id) if a.organ else None,
            "donor_name": a.organ.donor.name if a.organ and a.organ.donor else None,
            "donor_code": a.organ.donor.donor_code if a.organ and a.organ.donor else None,
            "hospital_name": (
                a.organ.donor.hospital.name
                if a.organ and a.organ.donor and a.organ.donor.hospital
                else None
            ),
            # Recipient
            "recipient_id": str(a.recipient_id),
            "recipient_code": a.recipient.recipient_code if a.recipient else "UNKNOWN",
            "recipient_name": a.recipient.name if a.recipient else "UNKNOWN",
            "recipient_blood_group": a.recipient.blood_group if a.recipient else None,
            "urgency": a.recipient.urgency if a.recipient else "MODERATE",
            "priority": a.recipient.priority if a.recipient else "MEDIUM",
            # Match
            "compatibility_score": a.match.compatibility_score if a.match else None,
            "compatibility_score_pct": score_pct,
            "rank": a.match.rank if a.match else None,
            # Clinical assessment — REAL data from MedicalAssessment table
            "clinical_assessment_status": latest_assessment.suitability if latest_assessment else None,
            "clinical_risk_level": latest_assessment.risk_level if latest_assessment else None,
            # Allocation decision
            "status": a.status,
            "approved_by": a.approver.username if a.approver else None,
            "rejection_reason": a.rejection_reason,
            "fabric_tx_id": a.fabric_tx_id,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        })

    return results


@router.get("/history")
async def list_allocation_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_allocation_authority_or_admin(current_user)
    q = (
        select(Allocation)
        .options(
            selectinload(Allocation.organ).selectinload(Organ.donor),
            selectinload(Allocation.recipient),
            selectinload(Allocation.approver),
            selectinload(Allocation.match),
        )
        .order_by(Allocation.updated_at.desc())
    )
    res = await db.execute(q)
    allocs = res.scalars().all()

    approved_statuses = {"DATABASE_COMMITTED", "FABRIC_SUBMITTED", "FABRIC_CONFIRMED", "APPROVED"}

    return [
        {
            "id": str(a.id),
            "match_id": str(a.match_id),
            "organ_id": str(a.organ_id),
            "organ_code": a.organ.organ_code if a.organ else f"ORG-{str(a.organ_id)[:6].upper()}",
            "organ_type": a.organ.organ_type if a.organ else "UNKNOWN",
            "organ_blood_group": a.organ.blood_group if a.organ else None,
            "donor_name": a.organ.donor.name if a.organ and a.organ.donor else None,
            "donor_code": a.organ.donor.donor_code if a.organ and a.organ.donor else None,
            "recipient_id": str(a.recipient_id),
            "recipient_code": a.recipient.recipient_code if a.recipient else "UNKNOWN",
            "recipient_name": a.recipient.name if a.recipient else "UNKNOWN",
            "compatibility_score": a.match.compatibility_score if a.match else None,
            "compatibility_score_pct": _compute_score_pct(a.match.compatibility_score if a.match else None),
            "rank": a.match.rank if a.match else None,
            "decision": (
                "APPROVED" if a.status in approved_statuses
                else "REJECTED" if a.status == "REJECTED"
                else "PENDING"
            ),
            "approved_by": a.approver.username if a.approver else None,
            "rejection_reason": a.rejection_reason,
            "fabric_tx_id": a.fabric_tx_id,
            "status": a.status,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        }
        for a in allocs
    ]


@router.put("/matches/{match_id}/score")
@router.patch("/matches/{match_id}")
async def attempt_modify_score(match_id: uuid.UUID):
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Allocation Authority cannot modify matching engine scores or ranking.",
    )
