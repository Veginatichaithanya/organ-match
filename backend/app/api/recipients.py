import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database.session import get_db
from app.models.user import User
from app.models.recipient import Recipient
from app.models.hospital import Hospital
from app.models.medical_assessment import MedicalAssessment
from app.schemas.recipient import RecipientCreate, RecipientUpdate, RecipientResponse, RecipientDetailResponse
from app.schemas.deletion import DeletionRequest, DeletionResponse
from app.security.authentication import get_current_user
from app.services.authorization_service import AuthorizationService
from app.services.deletion_service import DeletionService

router = APIRouter(prefix="/recipients", tags=["Recipients"])

@router.post("/", response_model=RecipientResponse, status_code=status.HTTP_201_CREATED)
async def create_recipient(
    payload: RecipientCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new recipient on the waiting list. Validates boundaries (ABAC).
    """
    role_name = current_user.roles[0].name if current_user.roles else ""
    if role_name == "HOSPITAL_COORDINATOR":
        if not current_user.hospital_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Coordinator is not assigned to a hospital."
            )
        effective_hospital_id = payload.hospital_id or current_user.hospital_id
    else:
        effective_hospital_id = payload.hospital_id or current_user.hospital_id
        if not effective_hospital_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hospital ID is required."
            )

    # Auto-generate recipient_code if not supplied
    recipient_code = payload.recipient_code
    if not recipient_code:
        recipient_code = f"REC-{uuid.uuid4().hex[:8].upper()}"

    payload_dict = payload.model_dump()
    payload_dict["recipient_code"] = recipient_code
    payload_dict["hospital_id"] = effective_hospital_id

    # Evaluate permissions and context policies (ABAC)
    AuthorizationService.authorize(
        user=current_user,
        permission_name="CREATE_RECIPIENT",
        resource_type="Recipient",
        operation="CREATE",
        resource=payload_dict
    )

    # For Hospital Coordinator, force effective_hospital_id to caller's hospital_id
    if role_name == "HOSPITAL_COORDINATOR":
        effective_hospital_id = current_user.hospital_id

    # Check if recipient_code is unique
    existing_query = select(Recipient).where(Recipient.recipient_code == recipient_code)
    existing_result = await db.execute(existing_query)
    if existing_result.scalars().first():
        if payload.recipient_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Recipient code {payload.recipient_code} is already registered."
            )
        recipient_code = f"REC-{uuid.uuid4().hex[:8].upper()}"

    new_recipient = Recipient(
        hospital_id=effective_hospital_id,
        recipient_code=recipient_code,
        name=payload.name,
        age=payload.age,
        blood_group=payload.blood_group,
        required_organ=payload.required_organ,
        medical_details=payload.medical_details or {},
        hla_information=payload.hla_information or {},
        priority=payload.priority,
        urgency=payload.urgency,
        status="ACTIVE",
        created_by=current_user.id,
        updated_by=current_user.id
    )

    db.add(new_recipient)
    await db.commit()
    await db.refresh(new_recipient)

    return new_recipient

@router.get("/", response_model=List[RecipientResponse])
async def list_recipients(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all active recipients. Filters dynamically based on hospital context (ABAC).
    """
    AuthorizationService.authorize(
        user=current_user,
        permission_name="VIEW_RECIPIENT",
        resource_type="Recipient",
        operation="READ"
    )

    query = select(Recipient).where(Recipient.status != "ARCHIVED")

    # Enforce row-level hospital boundaries (ABAC)
    role_name = current_user.roles[0].name if current_user.roles else "guest"
    if role_name in ["HOSPITAL_COORDINATOR", "DOCTOR"]:
        query = query.where(Recipient.hospital_id == current_user.hospital_id)

    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{id}", response_model=RecipientDetailResponse)
async def get_recipient(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve a specific recipient details by ID. Validates access scope and returns full hospital, author, and version history.
    """
    query = select(Recipient).where(Recipient.id == id)
    result = await db.execute(query)
    recipient = result.scalars().first()

    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient not found."
        )

    AuthorizationService.authorize(
        user=current_user,
        permission_name="VIEW_RECIPIENT",
        resource_type="Recipient",
        operation="READ",
        resource=recipient
    )

    # Resolve Hospital Name
    hospital_name = "Not assigned"
    if recipient.hospital_id:
        h_res = await db.execute(select(Hospital).where(Hospital.id == recipient.hospital_id))
        h = h_res.scalars().first()
        if h:
            hospital_name = f"{h.name} ({h.location})" if h.location else h.name

    # Resolve Creator User
    created_by_name = "Authorized User"
    created_by_role = "Hospital Coordinator"
    if recipient.created_by:
        u_res = await db.execute(select(User).where(User.id == recipient.created_by))
        u = u_res.scalars().first()
        if u:
            created_by_name = u.username or u.email
            created_by_role = u.roles[0].name.replace("_", " ").title() if u.roles else "User"

    # Resolve Updater User
    updated_by_name = created_by_name
    updated_by_role = created_by_role
    if recipient.updated_by:
        u2_res = await db.execute(select(User).where(User.id == recipient.updated_by))
        u2 = u2_res.scalars().first()
        if u2:
            updated_by_name = u2.username or u2.email
            updated_by_role = u2.roles[0].name.replace("_", " ").title() if u2.roles else "User"

    # Resolve clinical medical assessment if any
    med_suitability = "Not Assessed"
    med_notes = None
    med_res = await db.execute(
        select(MedicalAssessment)
        .where(MedicalAssessment.entity_type == "Recipient", MedicalAssessment.entity_id == recipient.id)
        .order_by(MedicalAssessment.created_at.desc())
    )
    latest_med = med_res.scalars().first()
    if latest_med:
        med_suitability = latest_med.suitability
        med_notes = latest_med.clinical_notes

    recipient_dict = {
        "id": recipient.id,
        "recipient_code": recipient.recipient_code,
        "name": recipient.name,
        "age": recipient.age,
        "blood_group": recipient.blood_group,
        "required_organ": recipient.required_organ,
        "medical_details": recipient.medical_details,
        "hla_information": recipient.hla_information,
        "priority": recipient.priority,
        "urgency": recipient.urgency,
        "hospital_id": recipient.hospital_id,
        "status": recipient.status,
        "created_by": recipient.created_by,
        "updated_by": recipient.updated_by,
        "created_at": recipient.created_at,
        "updated_at": recipient.updated_at,
        "hospital_name": hospital_name,
        "created_by_name": created_by_name,
        "updated_by_name": updated_by_name,
        "created_by_role": created_by_role,
        "updated_by_role": updated_by_role,
        "medical_suitability": med_suitability,
        "medical_notes": med_notes,
    }

    return RecipientDetailResponse(**recipient_dict)


@router.patch("/{id}", response_model=RecipientResponse)
@router.put("/{id}", response_model=RecipientResponse)
async def update_recipient(
    id: uuid.UUID,
    payload: RecipientUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a recipient record. Validates authorization scope.
    """
    query = select(Recipient).where(Recipient.id == id)
    result = await db.execute(query)
    recipient = result.scalars().first()

    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient not found."
        )

    AuthorizationService.authorize(
        user=current_user,
        permission_name="EDIT_RECIPIENT",
        resource_type="Recipient",
        operation="UPDATE",
        resource=recipient
    )

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(recipient, key, value)
    
    recipient.updated_by = current_user.id

    await db.commit()
    await db.refresh(recipient)

    return recipient

@router.delete("/{id}", response_model=DeletionResponse)
async def delete_recipient(
    id: uuid.UUID,
    payload: DeletionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Secure deletion of recipient record requiring mandatory justification and audit logging.
    """
    return await DeletionService.delete_record(
        db=db,
        current_user=current_user,
        entity_type_str="Recipient",
        entity_id=id,
        reason=payload.reason
    )

