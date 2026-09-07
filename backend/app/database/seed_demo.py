"""
Deterministic Demo Data Seeder for Development & Demonstration
--------------------------------------------------------------
Seeds realistic clinical dataset for Hospital A (and Hospital B if needed)
without affecting production logic or weakening any security constraints.
"""
import sys
import os
import secrets
import asyncio
import uuid
from datetime import datetime, timedelta

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import app.database.base
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.database.session import async_session_maker
from app.models.hospital import Hospital
from app.models.user import User, Role, Permission
from app.models.donor import Donor
from app.models.organ import Organ
from app.models.recipient import Recipient
from app.models.match import Match
from app.models.medical_assessment import MedicalAssessment
from app.services.matching_service import MatchingService
from app.security.authentication import hash_password


async def seed_demo_data():
    """
    Ensures Hospital A has realistic demonstration records for the Doctor workflow:
    - 4 Donors
    - 4 Organs
    - 4 Recipients
    - Multi-criteria matches
    - 2 Completed Medical Assessments
    """
    async with async_session_maker() as session:
        # 1. Fetch or verify Hospitals
        hosp_a_q = select(Hospital).where(Hospital.name.ilike("%Hospital A%"))
        hosp_a_res = await session.execute(hosp_a_q)
        hosp_a = hosp_a_res.scalars().first()

        if not hosp_a:
            # Check by hardcoded ID if exists
            hosp_a_id = uuid.UUID("a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0")
            hosp_a = await session.get(Hospital, hosp_a_id)
            if not hosp_a:
                hosp_a = Hospital(
                    id=hosp_a_id,
                    name="Hospital A (General Care)",
                    location="New Delhi, India",
                )
                session.add(hosp_a)
                await session.flush()

        # 2. Verify Doctor User
        doctor_q = select(User).where(User.username == "doctor").options(selectinload(User.roles))
        doctor_res = await session.execute(doctor_q)
        doctor_user = doctor_res.scalars().first()

        if not doctor_user:
            # Check role
            role_q = select(Role).where(Role.name == "DOCTOR")
            role_res = await session.execute(role_q)
            doc_role = role_res.scalars().first()
            if not doc_role:
                doc_role = Role(name="DOCTOR", description="Medical Doctor / Clinical Reviewer")
                session.add(doc_role)
                await session.flush()

            # User passwords are created and managed securely in the database.
            # If not yet present, generate a dynamic random hash or use environment variable.
            seed_pass = os.getenv("SEED_USER_PASSWORD") or secrets.token_urlsafe(16)
            doctor_user = User(
                username="doctor",
                email="doctor@organmatch.in",
                password_hash=hash_password(seed_pass),
                hospital_id=hosp_a.id,
                status="Active",
            )
            doctor_user.roles.append(doc_role)
            session.add(doctor_user)
            await session.flush()
        else:
            if doctor_user.hospital_id != hosp_a.id:
                doctor_user.hospital_id = hosp_a.id
                await session.flush()

        # 3. Check existing donors in Hospital A
        existing_donors_q = select(Donor).where(Donor.hospital_id == hosp_a.id)
        existing_donors = (await session.execute(existing_donors_q)).scalars().all()

        if len(existing_donors) < 4:
            # Seed 4 realistic Donors
            donors_data = [
                {
                    "donor_code": "D001",
                    "name": "Rajesh Sharma",
                    "age": 38,
                    "blood_group": "O+",
                    "hla": {
                        "A": "02,24", "B": "07,44", "DR": "04,07",
                        "raw": "A2,A24;B7,B44;DR4,DR7",
                        "alleles": ["A2", "A24", "B7", "B44", "DR4", "DR7"]
                    },
                    "medical": {
                        "status": "Suitable",
                        "notes": "Brain-dead donor, normotensive, cleared viral serology.",
                        "weight_kg": 72.0,
                        "gender": "Male"
                    },
                    "organ_type": "KIDNEY",
                    "organ_code": "ORG-K001"
                },
                {
                    "donor_code": "D002",
                    "name": "Anita Desai",
                    "age": 29,
                    "blood_group": "A+",
                    "hla": {
                        "A": "01,03", "B": "08,35", "DR": "03,15",
                        "raw": "A1,A3;B8,B35;DR3,DR15",
                        "alleles": ["A1", "A3", "B8", "B35", "DR3", "DR15"]
                    },
                    "medical": {
                        "status": "Suitable",
                        "notes": "Deceased donor, excellent cardiac ejection fraction (65%).",
                        "weight_kg": 58.0,
                        "gender": "Female"
                    },
                    "organ_type": "HEART",
                    "organ_code": "ORG-H001"
                },
                {
                    "donor_code": "D003",
                    "name": "Vikram Malhotra",
                    "age": 45,
                    "blood_group": "B+",
                    "hla": {
                        "A": "02,11", "B": "15,40", "DR": "04,11",
                        "raw": "A2,A11;B15,B40;DR4,DR11",
                        "alleles": ["A2", "A11", "B15", "B40", "DR4", "DR11"]
                    },
                    "medical": {
                        "status": "Under Review",
                        "notes": "Standard criteria donor, arterial blood gas PaO2/FiO2 > 400.",
                        "weight_kg": 76.0,
                        "gender": "Male"
                    },
                    "organ_type": "LUNG",
                    "organ_code": "ORG-L001"
                },
                {
                    "donor_code": "D004",
                    "name": "Sunita Rao",
                    "age": 52,
                    "blood_group": "O-",
                    "hla": {
                        "A": "03,24", "B": "07,18", "DR": "01,04",
                        "raw": "A3,A24;B7,B18;DR1,DR4",
                        "alleles": ["A3", "A24", "B7", "B18", "DR1", "DR4"]
                    },
                    "medical": {
                        "status": "Suitable",
                        "notes": "Stable hemodynamics, creatinine 0.9 mg/dL.",
                        "weight_kg": 64.0,
                        "gender": "Female"
                    },
                    "organ_type": "KIDNEY",
                    "organ_code": "ORG-K002"
                }
            ]

            created_organs = []
            for d_info in donors_data:
                # Check if donor_code exists
                existing_d = (await session.execute(
                    select(Donor).where(Donor.donor_code == d_info["donor_code"])
                )).scalars().first()

                if not existing_d:
                    donor = Donor(
                        hospital_id=hosp_a.id,
                        donor_code=d_info["donor_code"],
                        name=d_info["name"],
                        age=d_info["age"],
                        blood_group=d_info["blood_group"],
                        hla_information=d_info["hla"],
                        medical_details=d_info["medical"],
                        status="ACTIVE",
                        created_by=doctor_user.id,
                        updated_by=doctor_user.id,
                    )
                    session.add(donor)
                    await session.flush()

                    # Create corresponding organ
                    organ = Organ(
                        donor_id=donor.id,
                        organ_code=d_info["organ_code"],
                        organ_type=d_info["organ_type"],
                        blood_group=d_info["blood_group"],
                        medical_details={"viability": "Optimal", "ischemic_risk": "Low"},
                        status="AVAILABLE",
                        created_by=doctor_user.id,
                        updated_by=doctor_user.id,
                    )
                    session.add(organ)
                    await session.flush()
                    created_organs.append(organ)

        # 4. Check existing recipients in Hospital A
        existing_recips_q = select(Recipient).where(Recipient.hospital_id == hosp_a.id)
        existing_recips = (await session.execute(existing_recips_q)).scalars().all()

        if len(existing_recips) < 4:
            recipients_data = [
                {
                    "recipient_code": "R101",
                    "name": "Amit Patel",
                    "age": 42,
                    "blood_group": "O+",
                    "required_organ": "KIDNEY",
                    "priority": "HIGH",
                    "urgency": "CRITICAL",
                    "hla": {
                        "A": "02,24", "B": "07,44", "DR": "04,07",
                        "raw": "A2,A24;B7,B44;DR4,DR7",
                        "alleles": ["A2", "A24", "B7", "B44", "DR4", "DR7"]
                    },
                    "medical": {
                        "condition": "End-stage renal disease secondary to hypertension",
                        "suitability_score": 92,
                        "gender": "Male",
                        "weight_kg": 70.0
                    }
                },
                {
                    "recipient_code": "R102",
                    "name": "Priya Sundaram",
                    "age": 35,
                    "blood_group": "A+",
                    "required_organ": "HEART",
                    "priority": "HIGH",
                    "urgency": "CRITICAL",
                    "hla": {
                        "A": "01,03", "B": "08,35", "DR": "03,15",
                        "raw": "A1,A3;B8,B35;DR3,DR15",
                        "alleles": ["A1", "A3", "B8", "B35", "DR3", "DR15"]
                    },
                    "medical": {
                        "condition": "Dilated cardiomyopathy, NYHA Class IV",
                        "suitability_score": 88,
                        "gender": "Female",
                        "weight_kg": 56.0
                    }
                },
                {
                    "recipient_code": "R103",
                    "name": "Meera Joshi",
                    "age": 48,
                    "blood_group": "B+",
                    "required_organ": "LUNG",
                    "priority": "MEDIUM",
                    "urgency": "HIGH",
                    "hla": {
                        "A": "02,11", "B": "15,40", "DR": "04,11",
                        "raw": "A2,A11;B15,B40;DR4,DR11",
                        "alleles": ["A2", "A11", "B15", "B40", "DR4", "DR11"]
                    },
                    "medical": {
                        "condition": "Idiopathic pulmonary fibrosis",
                        "suitability_score": 85,
                        "gender": "Female",
                        "weight_kg": 68.0
                    }
                },
                {
                    "recipient_code": "R104",
                    "name": "Karthik Nambiar",
                    "age": 39,
                    "blood_group": "A+",
                    "required_organ": "KIDNEY",
                    "priority": "MEDIUM",
                    "urgency": "MODERATE",
                    "hla": {
                        "A": "02,03", "B": "07,18", "DR": "04,07",
                        "raw": "A2,A3;B7,B18;DR4,DR7",
                        "alleles": ["A2", "A3", "B7", "B18", "DR4", "DR7"]
                    },
                    "medical": {
                        "condition": "Glomerulonephritis with chronic renal failure",
                        "suitability_score": 80,
                        "gender": "Male",
                        "weight_kg": 74.0
                    }
                }
            ]

            for r_info in recipients_data:
                existing_r = (await session.execute(
                    select(Recipient).where(Recipient.recipient_code == r_info["recipient_code"])
                )).scalars().first()

                if not existing_r:
                    recipient = Recipient(
                        hospital_id=hosp_a.id,
                        recipient_code=r_info["recipient_code"],
                        name=r_info["name"],
                        age=r_info["age"],
                        blood_group=r_info["blood_group"],
                        required_organ=r_info["required_organ"],
                        hla_information=r_info["hla"],
                        medical_details=r_info["medical"],
                        priority=r_info["priority"],
                        urgency=r_info["urgency"],
                        status="ACTIVE",
                        created_by=doctor_user.id,
                        updated_by=doctor_user.id,
                    )
                    session.add(recipient)
                    await session.flush()

        await session.commit()

        # 5. Run matching for all hospital organs to create candidate matches
        organs_q = (
            select(Organ)
            .join(Donor, Organ.donor_id == Donor.id)
            .where(Donor.hospital_id == hosp_a.id, Organ.status == "AVAILABLE")
        )
        available_organs = (await session.execute(organs_q)).scalars().all()

        for organ in available_organs:
            # Check if matches exist
            matches_exist = (await session.execute(
                select(Match).where(Match.organ_id == organ.id)
            )).scalars().first()

            if not matches_exist:
                try:
                    await MatchingService.run_matching(organ.id, session)
                except Exception as e:
                    print(f"Matching run error for {organ.organ_code}: {e}")

        # 6. Seed completed Medical Assessments (2 completed, others pending)
        d001 = (await session.execute(select(Donor).where(Donor.donor_code == "D001"))).scalars().first()
        if d001:
            ass_d001 = (await session.execute(
                select(MedicalAssessment).where(
                    MedicalAssessment.entity_type == "Donor",
                    MedicalAssessment.entity_id == d001.id
                )
            )).scalars().first()
            if not ass_d001:
                session.add(MedicalAssessment(
                    entity_type="Donor",
                    entity_id=d001.id,
                    suitability="APPROVED",
                    risk_level="LOW",
                    clinical_notes="Cleared all immunological and infectious disease screening. Renal function optimal.",
                    recommendation="Proceed to organ allocation matching.",
                    reviewed_by=doctor_user.id,
                    reviewed_at=datetime.utcnow() - timedelta(hours=3),
                ))

        r101 = (await session.execute(select(Recipient).where(Recipient.recipient_code == "R101"))).scalars().first()
        if r101:
            ass_r101 = (await session.execute(
                select(MedicalAssessment).where(
                    MedicalAssessment.entity_type == "Recipient",
                    MedicalAssessment.entity_id == r101.id
                )
            )).scalars().first()
            if not ass_r101:
                session.add(MedicalAssessment(
                    entity_type="Recipient",
                    entity_id=r101.id,
                    suitability="APPROVED",
                    risk_level="MEDIUM",
                    clinical_notes="Patient hemodynamically optimized. High urgency status validated for kidney waitlist.",
                    recommendation="Recommended for clinical match review.",
                    reviewed_by=doctor_user.id,
                    reviewed_at=datetime.utcnow() - timedelta(hours=2),
                ))

        await session.commit()
        print("Demo data seeded successfully for Hospital A.")


if __name__ == "__main__":
    asyncio.run(seed_demo_data())
