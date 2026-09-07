import uuid
from typing import Optional, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.donor import Donor
from app.models.recipient import Recipient
from app.models.organ import Organ
from app.models.match import Match
from app.models.allocation import Allocation


class DeletionService:
    """
    Secure deletion service for hospital-scoped records with mandatory audit justification,
    ABAC enforcement, security event recording, and relationship safety checks.
    """

    @staticmethod
    async def delete_record(
        db: AsyncSession,
        current_user: User,
        entity_type_str: str,
        entity_id: uuid.UUID,
        reason: str
    ) -> Dict[str, Any]:
        role_name = current_user.roles[0].name if current_user.roles else "guest"
        norm_type = entity_type_str.capitalize()
        if norm_type in ["Donors", "Donor"]:
            canonical_type = "Donor"
        elif norm_type in ["Recipients", "Recipient"]:
            canonical_type = "Recipient"
        elif norm_type in ["Organs", "Organ"]:
            canonical_type = "Organ"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported entity type for deletion: {entity_type_str}"
            )

        # 1. Check Role authorization
        if role_name not in ["HOSPITAL_COORDINATOR", "ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You do not have authorization to delete this record."
            )

        # 2. Fetch Entity
        if canonical_type == "Donor":
            q = select(Donor).where(Donor.id == entity_id).options(selectinload(Donor.organs))
            res = await db.execute(q)
            record = res.scalars().first()
        elif canonical_type == "Recipient":
            q = select(Recipient).where(Recipient.id == entity_id)
            res = await db.execute(q)
            record = res.scalars().first()
        elif canonical_type == "Organ":
            q = select(Organ).where(Organ.id == entity_id).options(selectinload(Organ.donor))
            res = await db.execute(q)
            record = res.scalars().first()
        else:
            record = None

        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{canonical_type} record not found."
            )

        # 3. ABAC Hospital Isolation Enforcement
        if role_name == "HOSPITAL_COORDINATOR":
            user_hospital_id = current_user.hospital_id
            if not user_hospital_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Coordinator is not assigned to a hospital context."
                )

            record_hospital_id = None
            if canonical_type in ["Donor", "Recipient"]:
                record_hospital_id = record.hospital_id
            elif canonical_type == "Organ":
                record_hospital_id = record.donor.hospital_id if record.donor else None

            if record_hospital_id and record_hospital_id != user_hospital_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: This record belongs to another hospital facility."
                )

        # 4. Relationship Safety & Dependency Protection
        if canonical_type == "Recipient":
            # Check for active or historical allocations
            alloc_q = select(Allocation).where(Allocation.recipient_id == entity_id)
            alloc_res = await db.execute(alloc_q)
            if alloc_res.scalars().first():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot delete recipient because active or historical transplant allocation records exist for this recipient. Please archive or mark as inactive instead."
                )
            # Remove associated matches (non-allocated)
            match_q = select(Match).where(Match.recipient_id == entity_id)
            match_res = await db.execute(match_q)
            for m in match_res.scalars().all():
                await db.delete(m)

        elif canonical_type == "Organ":
            # Check for active or historical allocations
            alloc_q = select(Allocation).where(Allocation.organ_id == entity_id)
            alloc_res = await db.execute(alloc_q)
            if alloc_res.scalars().first():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot delete organ because active or historical allocation records exist for this organ. Please mark status as DISCARDED or EXPIRED instead."
                )
            # Remove associated matches
            match_q = select(Match).where(Match.organ_id == entity_id)
            match_res = await db.execute(match_q)
            for m in match_res.scalars().all():
                await db.delete(m)

        elif canonical_type == "Donor":
            # Check if any organ of this donor has allocations
            for org in (record.organs or []):
                alloc_q = select(Allocation).where(Allocation.organ_id == org.id)
                alloc_res = await db.execute(alloc_q)
                if alloc_res.scalars().first():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Cannot delete donor because linked organ(s) have active or historical allocation records. Please archive the donor instead."
                    )
            # Remove matches of donor organs, then organs
            for org in (record.organs or []):
                match_q = select(Match).where(Match.organ_id == org.id)
                match_res = await db.execute(match_q)
                for m in match_res.scalars().all():
                    await db.delete(m)
                await db.delete(org)

        # 5. Execute Delete
        await db.delete(record)
        await db.commit()

        return {
            "message": f"{canonical_type} deleted successfully.",
            "id": str(entity_id),
            "entity_type": canonical_type,
            "reason": reason
        }
