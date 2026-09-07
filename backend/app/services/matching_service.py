import uuid
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.organ import Organ
from app.models.donor import Donor
from app.models.recipient import Recipient
from app.models.match import Match
from app.models.allocation import Allocation
from app.services.matching.base_rules import is_blood_compatible, count_shared_hla
from app.services.matching.heart_rules import check_heart_eligibility
from app.services.matching.lung_rules import check_lung_eligibility
from app.services.matching.kidney_rules import check_kidney_eligibility
from app.services.matching.pancreas_rules import check_pancreas_eligibility

class MatchingService:
    """
    Evaluates donor organs against waiting recipients using a 2-stage compatibility engine:
    Stage 1: Hard filters (Blood Group, Size, HLA matches).
    Stage 2: Weighted multi-criteria scoring (Blood match, Medical, HLA density, Priority).
    """

    @classmethod
    def evaluate_eligibility_with_reason(cls, organ: Organ, donor: Donor, recipient: Recipient) -> Tuple[bool, Optional[str]]:
        """
        Stage 1: Evaluates hard eligibility constraints. Returns (False, reason) if any check fails.
        """
        # 1. Verify blood compatibility
        if not is_blood_compatible(organ.blood_group, recipient.blood_group):
            return False, f"Blood group incompatible with selected organ: recipient blood group ({recipient.blood_group}) cannot receive donor blood group ({organ.blood_group})."

        # 2. Verify organ-specific criteria
        organ_type = organ.organ_type.upper()
        if organ_type == "HEART":
            if not check_heart_eligibility(donor, recipient):
                return False, "Organ-specific eligibility rule failed: donor-recipient weight difference exceeds 15% clinical threshold."
        elif organ_type in ["LUNG", "LUNGS"]:
            if not check_lung_eligibility(donor, recipient):
                return False, "Organ-specific eligibility rule failed: donor-recipient height difference exceeds 10% clinical threshold."
        elif organ_type == "KIDNEY":
            if not check_kidney_eligibility(donor, recipient):
                return False, "Organ-specific eligibility rule failed: zero shared HLA markers detected between donor and recipient."
        elif organ_type in ["PANCREAS", "PANCREATIC"]:
            if not check_pancreas_eligibility(donor, recipient):
                return False, "Organ-specific eligibility rule failed: recipient BMI exceeds clinical threshold (>= 32.0)."

        return True, None

    @classmethod
    def evaluate_eligibility(cls, organ: Organ, donor: Donor, recipient: Recipient) -> bool:
        """
        Stage 1: Evaluates hard eligibility constraints. Returns False if any check fails.
        """
        ok, _ = cls.evaluate_eligibility_with_reason(organ, donor, recipient)
        return ok

    @staticmethod
    def calculate_score(organ: Organ, donor: Donor, recipient: Recipient) -> Tuple[int, Dict[str, int]]:
        """
        Stage 2: Calculates weighted compatibility scores (0 - 100).
        """
        # Weights Configuration
        # Blood Compatibility: 25%, Medical: 30%, HLA: 25%, Priority: 20%
        
        # 1. Blood compatibility (25%)
        # Exact match = 100, compatible different = 50
        blood_points = 100 if organ.blood_group == recipient.blood_group else 50
        blood_weighted = round(blood_points * 0.25)

        # 2. Medical suitability (30%)
        # Calculate suitability matching age differences or default suitability parameters
        # Default recipient suitability is read from medical details, falling back to 70% if unpopulated
        med_suitability = recipient.medical_details.get("suitability_score", 70)
        # Apply age proximity penalty if both ages are known
        age_penalty = 0
        if donor.age and recipient.age:
            age_diff = abs(donor.age - recipient.age)
            if age_diff > 20:
                age_penalty = min(20, (age_diff - 20) * 0.5)
        med_points = max(0, min(100, float(med_suitability) - age_penalty))
        medical_weighted = round(med_points * 0.30)

        # 3. HLA / Tissue Compatibility (25%)
        shared_alleles = count_shared_hla(donor.hla_information, recipient.hla_information)
        if shared_alleles >= 3:
            hla_points = 100
        elif shared_alleles == 2:
            hla_points = 80
        elif shared_alleles == 1:
            hla_points = 50
        else:
            hla_points = 20
        hla_weighted = round(hla_points * 0.25)

        # 4. Recipient Priority & Urgency (20%)
        urgency_map = {
            "CRITICAL": 100,
            "HIGH": 80,
            "MODERATE": 50,
            "LOW": 20
        }
        urg_points = urgency_map.get(recipient.urgency.upper(), 50)
        priority_weighted = round(urg_points * 0.20)

        total_score = blood_weighted + medical_weighted + hla_weighted + priority_weighted
        
        breakdown = {
            "blood": blood_weighted,
            "medical": medical_weighted,
            "tissue": hla_weighted,
            "priority": priority_weighted
        }

        return total_score, breakdown

    @classmethod
    async def run_matching(
        cls,
        organ_id: uuid.UUID,
        db: AsyncSession,
        caller_hospital_id: uuid.UUID | None = None,
    ) -> List[Match]:
        """
        Executes the matching engine for a registered available organ.
        Saves and returns the ranked matches in the database.

        Args:
            organ_id: The organ to match against the recipient waitlist.
            db: Database session.
            caller_hospital_id: When provided, restricts the recipient candidate
                pool to recipients belonging to this hospital only. Pass None for
                roles with global scope (ADMIN, ALLOCATION_AUTHORITY, AUDITOR).
        """
        # Fetch organ and donor preloaded
        organ_query = select(Organ).where(Organ.id == organ_id).options(selectinload(Organ.donor))
        organ_result = await db.execute(organ_query)
        organ = organ_result.scalars().first()

        if not organ or organ.status not in ["AVAILABLE", "RESERVED"]:
            raise ValueError("Organ not found or status is not AVAILABLE.")

        donor = organ.donor

        # Fetch active recipients — scoped to caller's hospital when a hospital-bound
        # role is running matching (HOSPITAL_COORDINATOR, DOCTOR). Roles with global
        # scope (ADMIN, ALLOCATION_AUTHORITY, AUDITOR) pass caller_hospital_id=None
        # and receive the full unfiltered waitlist.
        recipient_query = select(Recipient).where(Recipient.status == "ACTIVE")
        if caller_hospital_id is not None:
            recipient_query = recipient_query.where(
                Recipient.hospital_id == caller_hospital_id
            )
        recipient_result = await db.execute(recipient_query)
        recipients = recipient_result.scalars().all()

        match_records: List[Match] = []

        for recipient in recipients:
            is_eligible, inelig_reason = cls.evaluate_eligibility_with_reason(organ, donor, recipient)
            
            if not is_eligible:
                # Store ineligible results with a score of 0 and explicit reason
                match = Match(
                    organ_id=organ.id,
                    recipient_id=recipient.id,
                    compatibility_score=0.0,
                    scoring_breakdown={
                        "blood": 0,
                        "medical": 0,
                        "tissue": 0,
                        "priority": 0,
                        "reason": inelig_reason or "Blood group or organ eligibility criteria failed."
                    },
                    rank=999,
                    status="REJECTED"
                )
                match_records.append(match)
                continue

            # Compute Stage 2 scores
            score, breakdown = cls.calculate_score(organ, donor, recipient)
            match_status = "PENDING" if score >= 50 else "REJECTED"
            if match_status == "REJECTED":
                breakdown = {
                    **breakdown,
                    "reason": f"Overall compatibility score ({score}%) below minimum 50% threshold."
                }

            match = Match(
                organ_id=organ.id,
                recipient_id=recipient.id,
                compatibility_score=float(score),
                scoring_breakdown=breakdown,
                rank=0, # Computed after sorting
                status=match_status
            )
            match_records.append(match)

        # Sort the eligible candidates by score descending to apply rankings
        eligible_matches = [m for m in match_records if m.status == "PENDING"]
        eligible_matches.sort(key=lambda x: x.compatibility_score, reverse=True)

        for rank_idx, m in enumerate(eligible_matches):
            m.rank = rank_idx + 1
            m.status = "PENDING"

        # Update organ status to RESERVED if eligible matches exist, else keep AVAILABLE
        organ.status = "RESERVED" if eligible_matches else "AVAILABLE"

        # Clean up previous unallocated match results for this organ to ensure clean state
        alloc_matches_subquery = select(Allocation.match_id).where(Allocation.organ_id == organ_id)
        delete_stmt = delete(Match).where(
            Match.organ_id == organ_id,
            Match.id.not_in(alloc_matches_subquery)
        )
        await db.execute(delete_stmt)

        # Save all matches to database
        db.add_all(match_records)
        await db.commit()

        # Re-fetch created matches sorted by rank
        query = (
            select(Match)
            .where(Match.organ_id == organ_id)
            .options(selectinload(Match.recipient))
        )
        if caller_hospital_id is not None:
            query = query.join(Recipient, Match.recipient_id == Recipient.id).where(Recipient.hospital_id == caller_hospital_id)
        query = query.order_by(Match.rank)
        res = await db.execute(query)
        return list(res.scalars().all())
