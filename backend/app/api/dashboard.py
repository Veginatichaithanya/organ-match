import asyncio
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func

from app.database.session import get_db
from app.models.user import User
from app.models.donor import Donor
from app.models.recipient import Recipient
from app.models.organ import Organ
from app.models.match import Match
from app.models.allocation import Allocation
from app.security.authentication import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/")
async def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns network-wide dashboard summary metrics and recent activity feeds asynchronously.
    """
    # Execute queries concurrently in parallel for peak performance
    (
        res_donor,
        res_recip,
        res_organ,
        res_match,
        res_alloc,
        res_recent_matches,
        res_recent_alloc,
    ) = await asyncio.gather(
        db.execute(select(func.count(Donor.id))),
        db.execute(select(func.count(Recipient.id))),
        db.execute(select(func.count(Organ.id)).where(Organ.status == "AVAILABLE")),
        db.execute(select(func.count(Match.id)).where(Match.status == "PENDING")),
        db.execute(select(func.count(Allocation.id))),
        db.execute(
            select(Match)
            .options(
                selectinload(Match.organ).selectinload(Organ.donor),
                selectinload(Match.recipient)
            )
            .order_by(Match.created_at.desc())
            .limit(5)
        ),
        db.execute(
            select(Allocation)
            .options(
                selectinload(Allocation.organ).selectinload(Organ.donor).selectinload(Donor.hospital),
                selectinload(Allocation.recipient),
                selectinload(Allocation.match),
                selectinload(Allocation.approver)
            )
            .order_by(Allocation.created_at.desc())
            .limit(5)
        ),
    )

    donor_count = res_donor.scalar() or 0
    recipient_count = res_recip.scalar() or 0
    organ_count = res_organ.scalar() or 0
    match_count = res_match.scalar() or 0
    allocation_count = res_alloc.scalar() or 0

    recent_matches_list = res_recent_matches.scalars().all()
    recent_matches = [
        {
            "id": str(m.id),
            "matchCode": f"MAT-{str(m.id)[:8].upper()}",
            "donorId": str(m.organ.donor.donor_code if m.organ and m.organ.donor else (m.organ.donor_id if m.organ else "")),
            "donorName": m.organ.donor.name if m.organ and m.organ.donor else "",
            "organType": m.organ.organ_type if m.organ else "Kidney",
            "organCode": m.organ.organ_code if m.organ else "",
            "topRecipient": m.recipient.recipient_code if m.recipient else str(m.recipient_id),
            "recipientId": m.recipient.recipient_code if m.recipient else str(m.recipient_id),
            "recipientName": m.recipient.name if m.recipient else "",
            "matchScore": int(round(m.compatibility_score * (100 if m.compatibility_score <= 1 else 1))) if m.compatibility_score is not None else None,
            "status": m.status,
            "createdAt": m.created_at.isoformat() if m.created_at else "",
            "updatedAt": m.updated_at.isoformat() if m.updated_at else ""
        }
        for m in recent_matches_list
    ]

    # Recent allocations
    recent_alloc_list = res_recent_alloc.scalars().all()
    recent_allocations = [
        {
            "id": str(a.id),
            "allocationCode": f"ALL-{str(a.id)[:8].upper()}",
            "matchId": str(a.match_id) if a.match_id else "",
            "matchCode": f"MAT-{str(a.match_id)[:8].upper()}" if a.match_id else "",
            "organId": str(a.organ_id) if a.organ_id else "",
            "organCode": a.organ.organ_code if a.organ else "",
            "organType": a.organ.organ_type if a.organ else "Organ",
            "donorId": str(a.organ.donor.donor_code if a.organ and a.organ.donor else (a.organ.donor_id if a.organ else "")),
            "donorName": a.organ.donor.name if a.organ and a.organ.donor else "",
            "recipientId": a.recipient.recipient_code if a.recipient else str(a.recipient_id),
            "recipientName": a.recipient.name if a.recipient else "",
            "matchScore": int(round(a.match.compatibility_score * (100 if a.match.compatibility_score <= 1 else 1))) if (a.match and a.match.compatibility_score is not None) else None,
            "medicalCompatibility": "High" if (a.match and (a.match.compatibility_score or 0) >= 0.75) else "Standard",
            "priority": a.recipient.priority if a.recipient and hasattr(a.recipient, "priority") else "Medium",
            "approvedBy": a.approver.username if a.approver else None,
            "status": a.status,
            "blockchainTx": a.fabric_tx_id or "",
            "isFabricConfirmed": a.status == "FABRIC_CONFIRMED",
            "timestamp": a.created_at.isoformat() if a.created_at else "",
            "updatedAt": a.updated_at.isoformat() if a.updated_at else "",
            "hospital": a.organ.donor.hospital.name if a.organ and a.organ.donor and a.organ.donor.hospital else (current_user.hospital.name if current_user.hospital else "Central Network")
        }
        for a in recent_alloc_list
    ]

    return {
        "stats": {
            "donors": donor_count,
            "recipients": recipient_count,
            "availableOrgans": organ_count,
            "pendingMatches": match_count,
            "allocations": allocation_count,
            "securityEvents": 0
        },
        "recentMatches": recent_matches,
        "recentAllocations": recent_allocations,
        "recentSecurityEvents": []
    }
