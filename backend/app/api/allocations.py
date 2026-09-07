import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database.session import get_db
from app.models.user import User
from app.models.match import Match
from app.models.organ import Organ
from app.models.donor import Donor
from app.models.recipient import Recipient
from app.models.allocation import Allocation

from app.schemas.allocation import AllocationCreate, AllocationDecisionRequest, AllocationResponse
from app.security.authentication import get_current_user
from app.services.authorization_service import AuthorizationService

router = APIRouter(prefix="/allocations", tags=["Allocations"])

@router.post("/", response_model=AllocationResponse, status_code=status.HTTP_201_CREATED)
async def create_allocation_request(
    payload: AllocationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Request an allocation for a specific compatibility match.
    Updates match status to SELECTED.
    """
    # Fetch match and nested objects to check hospital scopes
    match_query = (
        select(Match)
        .where(Match.id == payload.match_id)
        .options(selectinload(Match.organ).selectinload(Organ.donor), selectinload(Match.recipient))
    )
    match_result = await db.execute(match_query)
    match = match_result.scalars().first()

    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match record not found."
        )

    if match.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Allocation can only be requested for matches in PENDING status."
        )

    # Validate creation authorization (ABAC) using the matching organ's hospital scope
    AuthorizationService.authorize(
        user=current_user,
        permission_name="APPROVE_ALLOCATION", # Creating allocation requests requires allocation privileges
        resource_type="Allocation",
        operation="CREATE",
        resource=match.organ
    )

    # Create new allocation record in PENDING status
    new_allocation = Allocation(
        match_id=match.id,
        organ_id=match.organ_id,
        recipient_id=match.recipient_id,
        status="PENDING",
        created_by=current_user.id,
        updated_by=current_user.id
    )

    # Update match to show candidate has been selected for review
    match.status = "SELECTED"

    db.add(new_allocation)
    await db.commit()
    await db.refresh(new_allocation)
    return new_allocation

@router.get("/", response_model=List[AllocationResponse])
async def list_allocations(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List allocations. Filters list dynamically based on hospital context (ABAC) and status.
    """
    AuthorizationService.authorize(
        user=current_user,
        permission_name="VIEW_MATCH",
        resource_type="Allocation",
        operation="READ"
    )

    query = (
        select(Allocation)
        .outerjoin(Organ, Allocation.organ_id == Organ.id)
        .outerjoin(Donor, Organ.donor_id == Donor.id)
        .options(
            selectinload(Allocation.organ).selectinload(Organ.donor),
            selectinload(Allocation.recipient),
            selectinload(Allocation.match),
            selectinload(Allocation.approver),
        )
    )

    role_name = current_user.roles[0].name if current_user.roles else "guest"
    if role_name in ["HOSPITAL_COORDINATOR", "DOCTOR"]:
        # Enforce reading limits matching coordinator's local hospital ID
        query = query.where(Donor.hospital_id == current_user.hospital_id)

    if status and status.strip() and status.strip().lower() != "all":
        st = status.strip()
        st_upper = st.upper()
        if st_upper in ["APPROVED", "DATABASE_COMMITTED", "FABRIC_SUBMITTED", "FABRIC_CONFIRMED"]:
            query = query.where(Allocation.status.in_(["DATABASE_COMMITTED", "FABRIC_SUBMITTED", "FABRIC_CONFIRMED", "APPROVED"]))
        elif st_upper in ["PENDING", "PENDING REVIEW", "SELECTED"]:
            query = query.where(Allocation.status.in_(["PENDING", "SELECTED"]))
        elif st_upper == "REJECTED":
            query = query.where(Allocation.status == "REJECTED")
        elif st_upper == "COMPLETED":
            query = query.where(Allocation.status.in_(["COMPLETED", "DATABASE_COMMITTED", "FABRIC_CONFIRMED"]))
        else:
            query = query.where(Allocation.status.ilike(f"%{st}%"))

    query = query.order_by(Allocation.created_at.desc())

    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{id}", response_model=AllocationResponse)
async def get_allocation(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve details of a specific allocation. Supports querying by allocation ID or match ID.
    """
    query = (
        select(Allocation)
        .where((Allocation.id == id) | (Allocation.match_id == id))
        .options(
            selectinload(Allocation.organ).selectinload(Organ.donor),
            selectinload(Allocation.recipient),
            selectinload(Allocation.match),
            selectinload(Allocation.approver),
        )
    )
    result = await db.execute(query)
    allocation = result.scalars().first()

    if not allocation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Allocation not found."
        )

    # Validate viewing permission on this allocation's organ context
    AuthorizationService.authorize(
        user=current_user,
        permission_name="VIEW_MATCH",
        resource_type="Allocation",
        operation="READ",
        resource=allocation.organ
    )

    return allocation

@router.post("/{id}/approve", response_model=AllocationResponse)
async def approve_allocation(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Approve an organ allocation. Transitions organ and recipient statuses to ALLOCATED.
    Sets status to DATABASE_COMMITTED and triggers Hyperledger Fabric verification anchoring.
    Supports approving by Allocation ID or directly by Match ID.
    """
    query = (
        select(Allocation)
        .where((Allocation.id == id) | (Allocation.match_id == id))
        .options(
            selectinload(Allocation.organ),
            selectinload(Allocation.recipient),
            selectinload(Allocation.match)
        )
    )
    result = await db.execute(query)
    allocation = result.scalars().first()

    if not allocation:
        # Check if id corresponds to a Match record
        match_query = (
            select(Match)
            .where(Match.id == id)
            .options(
                selectinload(Match.organ).selectinload(Organ.donor),
                selectinload(Match.recipient)
            )
        )
        match_result = await db.execute(match_query)
        match = match_result.scalars().first()

        if match:
            # Double-allocation protection: Ensure organ is not already allocated
            if match.organ.status == "ALLOCATED":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Organ {match.organ.organ_type} (ID: {match.organ.id}) has already been allocated."
                )

            # Create new allocation record in PENDING status for this match
            allocation = Allocation(
                match_id=match.id,
                organ_id=match.organ_id,
                recipient_id=match.recipient_id,
                status="PENDING",
                created_by=current_user.id,
                updated_by=current_user.id
            )
            match.status = "SELECTED"
            db.add(allocation)
            await db.flush()
            allocation.organ = match.organ
            allocation.recipient = match.recipient
            allocation.match = match
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Allocation record not found."
            )

    if allocation.status not in ["PENDING", "SELECTED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve allocation in '{allocation.status}' status."
        )

    # Double-allocation protection: Ensure organ is not already allocated
    if allocation.organ.status == "ALLOCATED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Organ {allocation.organ.organ_type} (ID: {allocation.organ.id}) has already been allocated."
        )

    # Doctor Medical Review Check: Validate latest doctor assessment per entity
    from app.models.medical_assessment import MedicalAssessment
    doc_q = (
        select(MedicalAssessment)
        .where(
            MedicalAssessment.entity_type.in_(["Match", "Organ", "Recipient"]),
            MedicalAssessment.entity_id.in_([allocation.match_id, allocation.organ_id, allocation.recipient_id])
        )
        .order_by(MedicalAssessment.created_at.desc())
    )
    doc_assessments = (await db.execute(doc_q)).scalars().all()

    # Group by (entity_type, entity_id), keeping only the latest assessment per entity
    latest_by_entity = {}
    for a in doc_assessments:
        key = (a.entity_type, a.entity_id)
        if key not in latest_by_entity:
            latest_by_entity[key] = a

    latest_assessments = list(latest_by_entity.values())

    if not latest_assessments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot approve allocation: Clinical doctor medical review has not been completed."
        )

    if any(a.suitability == "NOT_APPROVED" for a in latest_assessments):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot approve allocation: Clinical doctor medical review is NOT_APPROVED."
        )

    if any(a.suitability == "NEEDS_REVIEW" for a in latest_assessments):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot approve allocation: Clinical doctor medical review is pending or marked NEEDS_REVIEW."
        )

    if not any(a.suitability == "APPROVED" for a in latest_assessments):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot approve allocation: Clinical doctor medical review is not APPROVED."
        )

    # Validate approval authority (ABAC)
    AuthorizationService.authorize(
        user=current_user,
        permission_name="APPROVE_ALLOCATION",
        resource_type="Allocation",
        operation="APPROVE"
    )

    # Perform PostgreSQL updates
    allocation.status = "DATABASE_COMMITTED"
    allocation.approved_by = current_user.id
    allocation.updated_by = current_user.id

    # Allocate organ and recipient
    allocation.organ.status = "ALLOCATED"
    allocation.recipient.status = "ALLOCATED"
    if allocation.match:
        allocation.match.status = "ACCEPTED"

    await db.commit()
    await db.refresh(allocation)

    # Trigger Hyperledger Fabric transaction anchoring
    import hashlib
    import json
    from app.blockchain.fabric_gateway import fabric_gateway

    state_dict = {
        "id": str(allocation.id),
        "match_id": str(allocation.match_id),
        "organ_id": str(allocation.organ_id),
        "recipient_id": str(allocation.recipient_id),
        "status": allocation.status,
    }
    state_hash = hashlib.sha256(json.dumps(state_dict, sort_keys=True).encode("utf-8")).hexdigest()

    try:
        allocation.status = "FABRIC_SUBMITTED"
        await db.commit()

        # Submit transaction to blockchain
        org_name = current_user.hospital.name if current_user.hospital else "Central Authority"
        tx_id = await fabric_gateway.submit_transaction(
            "RegisterAssetHash",
            str(allocation.id),
            "Allocation",
            state_hash,
            str(current_user.id),
            org_name,
            "APPROVE"
        )

        if tx_id:
            allocation.fabric_tx_id = tx_id
            allocation.status = "FABRIC_CONFIRMED"

            from app.models.blockchain_transaction import BlockchainTransaction
            tx_obj = BlockchainTransaction(
                fabric_tx_id=tx_id,
                record_id=allocation.id,
                record_type="Allocation",
                operation="ApproveAllocation",
                payload_hash=state_hash,
                channel=fabric_gateway.channel,
                chaincode=fabric_gateway.chaincode,
                status="CONFIRMED",
                created_by=current_user.id,
                confirmed_at=datetime.utcnow(),
            )
            db.add(tx_obj)
        else:
            allocation.status = "DATABASE_COMMITTED"
        
        await db.commit()
        await db.refresh(allocation)

    except Exception as e:
        allocation.status = "FABRIC_FAILED"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PostgreSQL committed, but Hyperledger Fabric transaction failed: {str(e)}"
        )

    return allocation

@router.post("/{id}/reject", response_model=AllocationResponse)
async def reject_allocation(
    id: uuid.UUID,
    payload: Optional[AllocationDecisionRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Reject an organ allocation request. Returns organ to AVAILABLE status.
    Supports rejecting by Allocation ID or directly by Match ID.
    """
    query = (
        select(Allocation)
        .where((Allocation.id == id) | (Allocation.match_id == id))
        .options(
            selectinload(Allocation.organ),
            selectinload(Allocation.recipient),
            selectinload(Allocation.match)
        )
    )
    result = await db.execute(query)
    allocation = result.scalars().first()

    if not allocation:
        # Check if id corresponds to a Match record
        match_query = (
            select(Match)
            .where(Match.id == id)
            .options(
                selectinload(Match.organ),
                selectinload(Match.recipient)
            )
        )
        match_result = await db.execute(match_query)
        match = match_result.scalars().first()

        if match:
            allocation = Allocation(
                match_id=match.id,
                organ_id=match.organ_id,
                recipient_id=match.recipient_id,
                status="PENDING",
                created_by=current_user.id,
                updated_by=current_user.id
            )
            match.status = "SELECTED"
            db.add(allocation)
            await db.flush()
            allocation.organ = match.organ
            allocation.recipient = match.recipient
            allocation.match = match
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Allocation record not found."
            )

    if allocation.status not in ["PENDING", "SELECTED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject allocation in '{allocation.status}' status."
        )

    rejection_reason = payload.rejection_reason if payload and payload.rejection_reason and payload.rejection_reason.strip() else "Rejected by authority."

    # Validate rejection authority (ABAC)
    AuthorizationService.authorize(
        user=current_user,
        permission_name="REJECT_ALLOCATION",
        resource_type="Allocation",
        operation="REJECT"
    )

    # Transition statuses
    allocation.status = "REJECTED"
    allocation.rejection_reason = rejection_reason
    allocation.updated_by = current_user.id

    # Return organ to AVAILABLE list
    if allocation.organ:
        allocation.organ.status = "AVAILABLE"
    # Return match status to REJECTED
    if allocation.match:
        allocation.match.status = "REJECTED"

    await db.commit()
    await db.refresh(allocation)

    return allocation
