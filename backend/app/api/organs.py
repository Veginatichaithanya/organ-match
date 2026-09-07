import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database.session import get_db
from app.models.user import User
from app.models.organ import Organ
from app.models.donor import Donor
from app.schemas.organ import OrganCreate, OrganUpdate, OrganResponse
from app.schemas.deletion import DeletionRequest, DeletionResponse
from app.security.authentication import get_current_user
from app.services.authorization_service import AuthorizationService
from app.services.deletion_service import DeletionService

router = APIRouter(prefix="/organs", tags=["Organs"])


def _auto_organ_code() -> str:
    """Generate a unique organ code: ORG- followed by 8 uppercase hex characters."""
    return "ORG-" + uuid.uuid4().hex[:8].upper()


def _pack_clinical_fields(payload: OrganCreate) -> dict:
    """
    Merge frontend clinical fields into the medical_details dict.
    These are stored in the existing JSONB column — no schema migration needed.
    """
    md = dict(payload.medical_details or {})

    if payload.laterality:
        md["laterality"] = payload.laterality
    if payload.harvested_at:
        md["harvested_at"] = payload.harvested_at
    if payload.warm_ischemia_minutes is not None:
        md["warm_ischemia_minutes"] = payload.warm_ischemia_minutes
    if payload.cold_ischemia_time:
        md["cold_ischemia_time"] = payload.cold_ischemia_time
    if payload.preservation_method:
        md["preservation_method"] = payload.preservation_method
    if payload.clinical_notes:
        md["notes"] = payload.clinical_notes
    if payload.additional_notes:
        md["additional_notes"] = payload.additional_notes

    return md


@router.post("/", response_model=OrganResponse, status_code=status.HTTP_201_CREATED)
async def create_organ(
    payload: OrganCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Register a harvested organ from a donor.
    - organ_code is auto-generated if not supplied by the client.
    - Clinical fields (laterality, harvested_at, ischemia times, preservation_method)
      are packed into the medical_details JSONB column.
    - Validates donor hospital alignment (ABAC).
    """
    # 1. Fetch the donor to verify it exists and get hospital context
    donor_query = select(Donor).where(Donor.id == payload.donor_id)
    donor_result = await db.execute(donor_query)
    donor = donor_result.scalars().first()

    if not donor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated donor not found."
        )

    # 2. ABAC authorization — uses donor's hospital for boundary check
    AuthorizationService.authorize(
        user=current_user,
        permission_name="CREATE_DONOR",  # Organ registration is under donor-management privileges
        resource_type="Organ",
        operation="CREATE",
        resource=donor
    )

    # 3. Resolve organ_code — auto-generate if not provided, ensure uniqueness
    organ_code = payload.organ_code
    if not organ_code:
        # Generate and retry up to 5 times on collision (practically impossible)
        for _ in range(5):
            candidate = _auto_organ_code()
            dup = await db.execute(select(Organ).where(Organ.organ_code == candidate))
            if not dup.scalars().first():
                organ_code = candidate
                break
        if not organ_code:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not generate a unique organ code. Please try again."
            )
    else:
        # If client supplied a code, still check uniqueness
        existing = await db.execute(select(Organ).where(Organ.organ_code == organ_code))
        if existing.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Organ code {organ_code} is already registered."
            )

    # 4. Pack clinical fields into medical_details
    medical_details = _pack_clinical_fields(payload)

    # 5. Determine initial status
    initial_status = "AVAILABLE"
    if payload.organ_status and payload.organ_status.upper() in (
        "AVAILABLE", "UNDER_REVIEW", "RESERVED", "ALLOCATED", "TRANSPLANTED", "EXPIRED", "DISCARDED"
    ):
        initial_status = payload.organ_status.upper()

    # 6. Set ischemic_start_time if harvested_at was supplied
    ischemic_start_time = None
    if payload.harvested_at:
        try:
            ischemic_start_time = datetime.fromisoformat(payload.harvested_at)
        except ValueError:
            pass  # Ignore unparseable datetime — it's still stored as string in medical_details

    blood_group = payload.blood_group if payload.blood_group and payload.blood_group not in ("", "Not provided") else donor.blood_group

    new_organ = Organ(
        donor_id=payload.donor_id,
        organ_code=organ_code,
        organ_type=payload.organ_type.upper(),
        blood_group=blood_group,
        medical_details=medical_details,
        status=initial_status,
        ischemic_start_time=ischemic_start_time,
        created_by=current_user.id,
        updated_by=current_user.id
    )

    db.add(new_organ)
    await db.commit()

    # Re-fetch with selectinload to satisfy async serialization of OrganResponse (donor relationship)
    stmt = select(Organ).where(Organ.id == new_organ.id).options(selectinload(Organ.donor))
    res = await db.execute(stmt)
    return res.scalars().first()



@router.get("/", response_model=List[OrganResponse])
async def list_organs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all active organs. Filters by hospital boundaries (ABAC).
    """
    AuthorizationService.authorize(
        user=current_user,
        permission_name="VIEW_ORGAN",
        resource_type="Organ",
        operation="READ"
    )

    # Join with Donor table to apply hospital filtering and preload donor relationship
    query = select(Organ).join(Donor).where(Organ.status != "UNAVAILABLE").options(selectinload(Organ.donor))

    role_name = current_user.roles[0].name if current_user.roles else "guest"
    if role_name in ["HOSPITAL_COORDINATOR", "DOCTOR"]:
        query = query.where(Donor.hospital_id == current_user.hospital_id)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{id}", response_model=OrganResponse)
async def get_organ(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve details of a specific organ.
    """
    query = select(Organ).where(Organ.id == id).options(selectinload(Organ.donor))
    result = await db.execute(query)
    organ = result.scalars().first()

    if not organ:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organ not found."
        )

    AuthorizationService.authorize(
        user=current_user,
        permission_name="VIEW_ORGAN",
        resource_type="Organ",
        operation="READ",
        resource=organ
    )

    return organ


@router.patch("/{id}", response_model=OrganResponse)
@router.put("/{id}", response_model=OrganResponse)
async def update_organ(
    id: uuid.UUID,
    payload: OrganUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update organ details or status.
    """
    query = select(Organ).where(Organ.id == id).options(selectinload(Organ.donor))
    result = await db.execute(query)
    organ = result.scalars().first()

    if not organ:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organ not found."
        )

    AuthorizationService.authorize(
        user=current_user,
        permission_name="EDIT_ORGAN",
        resource_type="Organ",
        operation="UPDATE",
        resource=organ
    )

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(organ, key, value)

    organ.updated_by = current_user.id

    await db.commit()

    # Re-fetch with selectinload to satisfy async serialization of OrganResponse (donor relationship)
    stmt = select(Organ).where(Organ.id == organ.id).options(selectinload(Organ.donor))
    res = await db.execute(stmt)
    return res.scalars().first()



@router.delete("/{id}", response_model=DeletionResponse)
async def delete_organ(
    id: uuid.UUID,
    payload: DeletionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Secure deletion of organ record requiring mandatory justification and audit logging.
    """
    return await DeletionService.delete_record(
        db=db,
        current_user=current_user,
        entity_type_str="Organ",
        entity_id=id,
        reason=payload.reason
    )
