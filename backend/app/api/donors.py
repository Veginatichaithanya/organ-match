import uuid
from datetime import datetime, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database.session import get_db
from app.models.user import User
from app.models.donor import Donor
from app.models.hospital import Hospital
from app.models.medical_assessment import MedicalAssessment
from app.schemas.donor import DonorCreate, DonorUpdate, DonorResponse, DonorDetailResponse
from app.schemas.deletion import DeletionRequest, DeletionResponse
from app.security.authentication import get_current_user
from app.services.authorization_service import AuthorizationService
from app.services.deletion_service import DeletionService

router = APIRouter(prefix="/donors", tags=["Donors"])

@router.post("/", response_model=DonorResponse, status_code=status.HTTP_201_CREATED)
async def create_donor(
    payload: DonorCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new donor. Validates organization boundaries (ABAC) and registration requirements.
    """
    role_name = current_user.roles[0].name if current_user.roles else ""
    if role_name == "HOSPITAL_COORDINATOR":
        if not current_user.hospital_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Coordinator is not assigned to a hospital."
            )
        effective_hospital_id = current_user.hospital_id
    else:
        effective_hospital_id = payload.hospital_id or current_user.hospital_id
        if not effective_hospital_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hospital ID is required."
            )

    # Auto-generate donor_code if not supplied
    donor_code = payload.donor_code
    if not donor_code:
        donor_code = f"DNR-{uuid.uuid4().hex[:8].upper()}"

    payload_dict = payload.model_dump()
    payload_dict["donor_code"] = donor_code
    payload_dict["hospital_id"] = payload.hospital_id or effective_hospital_id

    # Evaluate permissions and context policies (raises ABACDeniedError with ABAC_VIOLATION if hospital mismatch)
    AuthorizationService.authorize(
        user=current_user,
        permission_name="CREATE_DONOR",
        resource_type="Donor",
        operation="CREATE",
        resource=payload_dict
    )

    # For Hospital Coordinator, force effective_hospital_id to caller's hospital_id
    if role_name == "HOSPITAL_COORDINATOR":
        effective_hospital_id = current_user.hospital_id


    # Validation for registration requirements
    if payload.name is not None and not payload.name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full Name cannot be empty."
        )

    if payload.declaration_acknowledged is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please acknowledge the declaration before submitting."
        )


    # Validate Date of Birth and calculate age
    calculated_age = payload.age
    if payload.date_of_birth:
        if payload.date_of_birth > date.today():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Date of birth cannot be in the future."
            )
        today = date.today()
        dob = payload.date_of_birth
        calculated_age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    
    if calculated_age is None:
        calculated_age = 0

    if payload.registration_date and payload.registration_date > date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration date cannot be in the future."
        )

    # Validate donation preferences if provided in registration flow
    pref = payload.donation_preferences or {}
    organs_selected = pref.get("organs", [])
    tissues_selected = pref.get("tissues", [])
    other_organs_spec = pref.get("other_organs", "")
    other_tissues_spec = pref.get("other_tissues", "")

    # If preferences dict is passed, check constraints
    if pref:
        if not organs_selected and not tissues_selected:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Select at least one organ or tissue."
            )
        if "Other Organs" in organs_selected or "Other" in organs_selected:
            if not other_organs_spec or not str(other_organs_spec).strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Specify the other organ(s) selected."
                )
        if "Other Tissues" in tissues_selected or "Other" in tissues_selected:
            if not other_tissues_spec or not str(other_tissues_spec).strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Specify the other tissue(s) selected."
                )

    # Check if donor_code is unique
    existing_query = select(Donor).where(Donor.donor_code == donor_code)
    existing_result = await db.execute(existing_query)
    if existing_result.scalars().first():
        if payload.donor_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Donor code {payload.donor_code} is already registered."
            )
        donor_code = f"DNR-{uuid.uuid4().hex[:8].upper()}"

    # Create donor entity record
    new_donor = Donor(
        hospital_id=effective_hospital_id,
        donor_code=donor_code,
        name=payload.name.strip() if payload.name else None,
        age=calculated_age,
        date_of_birth=payload.date_of_birth,
        gender=payload.gender or "Not specified",
        contact_number=payload.contact_number,
        residential_address=payload.residential_address,
        blood_group=payload.blood_group or "Unknown",
        donation_preferences=payload.donation_preferences or {},
        declaration_acknowledged=payload.declaration_acknowledged if payload.declaration_acknowledged is not None else True,
        registration_date=payload.registration_date or date.today(),
        hla_information=payload.hla_information or {},
        medical_details=payload.medical_details or {},
        status="ACTIVE",
        created_by=current_user.id,
        updated_by=current_user.id
    )

    db.add(new_donor)
    await db.commit()
    await db.refresh(new_donor)

    return new_donor


@router.get("/", response_model=List[DonorResponse])
async def list_donors(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all active donors. Filters dynamically based on hospital boundaries (ABAC).
    """
    AuthorizationService.authorize(
        user=current_user,
        permission_name="VIEW_DONOR",
        resource_type="Donor",
        operation="READ"
    )

    query = select(Donor).where(Donor.status != "ARCHIVED")

    # Enforce row-level hospital security boundaries (ABAC)
    role_name = current_user.roles[0].name if current_user.roles else "guest"
    if role_name in ["HOSPITAL_COORDINATOR", "DOCTOR"]:
        query = query.where(Donor.hospital_id == current_user.hospital_id)

    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{id}", response_model=DonorDetailResponse)
async def get_donor(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve a specific donor by ID. Validates ownership bounds and populates real hospital, user, medical assessment and version/audit timeline.
    """
    query = select(Donor).where(Donor.id == id)
    result = await db.execute(query)
    donor = result.scalars().first()

    if not donor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Donor not found."
        )

    # Enforce access authority on the retrieved entity (ABAC)
    AuthorizationService.authorize(
        user=current_user,
        permission_name="VIEW_DONOR",
        resource_type="Donor",
        operation="READ",
        resource=donor
    )

    # Resolve hospital name
    hospital_name = None
    if donor.hospital_id:
        hosp_res = await db.execute(select(Hospital).where(Hospital.id == donor.hospital_id))
        hosp = hosp_res.scalars().first()
        if hosp:
            hospital_name = hosp.name

    # Resolve created_by user
    created_by_name = None
    created_by_role = None
    if donor.created_by:
        user_res = await db.execute(
            select(User).options(selectinload(User.roles)).where(User.id == donor.created_by)
        )
        u = user_res.scalars().first()
        if u:
            created_by_name = u.username or u.email
            created_by_role = u.roles[0].name.replace("_", " ").title() if u.roles else "User"

    # Resolve updated_by user
    updated_by_name = created_by_name
    updated_by_role = created_by_role
    if donor.updated_by and donor.updated_by != donor.created_by:
        u_res = await db.execute(
            select(User).options(selectinload(User.roles)).where(User.id == donor.updated_by)
        )
        u2 = u_res.scalars().first()
        if u2:
            updated_by_name = u2.username or u2.email
            updated_by_role = u2.roles[0].name.replace("_", " ").title() if u2.roles else "User"

    # Resolve clinical medical assessments
    med_suitability = "Not Assessed"
    med_notes = None
    med_res = await db.execute(
        select(MedicalAssessment)
        .where(MedicalAssessment.entity_type == "Donor", MedicalAssessment.entity_id == donor.id)
        .order_by(MedicalAssessment.created_at.desc())
    )
    latest_med = med_res.scalars().first()
    if latest_med:
        med_suitability = latest_med.suitability
        med_notes = latest_med.clinical_notes

    donor_dict = {
        "id": donor.id,
        "donor_code": donor.donor_code,
        "name": donor.name,
        "age": donor.age,
        "date_of_birth": donor.date_of_birth,
        "gender": donor.gender,
        "contact_number": donor.contact_number,
        "residential_address": donor.residential_address,
        "blood_group": donor.blood_group,
        "donation_preferences": donor.donation_preferences,
        "declaration_acknowledged": donor.declaration_acknowledged,
        "registration_date": donor.registration_date,
        "hla_information": donor.hla_information,
        "medical_details": donor.medical_details,
        "hospital_id": donor.hospital_id,
        "status": donor.status,
        "created_by": donor.created_by,
        "updated_by": donor.updated_by,
        "created_at": donor.created_at,
        "updated_at": donor.updated_at,
        "hospital_name": hospital_name,
        "created_by_name": created_by_name,
        "updated_by_name": updated_by_name,
        "created_by_role": created_by_role,
        "updated_by_role": updated_by_role,
        "medical_suitability": med_suitability,
        "medical_notes": med_notes,
    }

    return DonorDetailResponse(**donor_dict)


@router.patch("/{id}", response_model=DonorResponse)
@router.put("/{id}", response_model=DonorResponse)
async def update_donor(
    id: uuid.UUID,
    payload: DonorUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a donor record. Validates boundaries.
    """
    query = select(Donor).where(Donor.id == id)
    result = await db.execute(query)
    donor = result.scalars().first()

    if not donor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Donor not found."
        )

    # Validate modification authority (ABAC)
    AuthorizationService.authorize(
        user=current_user,
        permission_name="EDIT_DONOR",
        resource_type="Donor",
        operation="UPDATE",
        resource=donor
    )

    # Apply updates
    update_data = payload.model_dump(exclude_unset=True)
    if "date_of_birth" in update_data and update_data["date_of_birth"]:
        dob = update_data["date_of_birth"]
        today = date.today()
        calculated_age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        update_data["age"] = calculated_age

    for key, value in update_data.items():
        setattr(donor, key, value)

    donor.updated_by = current_user.id
    await db.commit()
    await db.refresh(donor)

    return donor

@router.delete("/{id}", response_model=DeletionResponse)
async def delete_donor(
    id: uuid.UUID,
    payload: DeletionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Secure deletion of donor record requiring mandatory justification and audit logging.
    """
    return await DeletionService.delete_record(
        db=db,
        current_user=current_user,
        entity_type_str="Donor",
        entity_id=id,
        reason=payload.reason
    )

