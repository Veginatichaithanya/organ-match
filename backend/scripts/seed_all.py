"""
Unified Database Initializer and Seeder for OrganMatch
------------------------------------------------------
Seeds hospitals, roles, permissions, default users, and demonstration clinical records.
Designed for automatic execution on container/server startup.
"""
import os
import sys
import uuid
import asyncio
from sqlalchemy import text
from sqlalchemy.orm import Session

# Ensure app package is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.session import sync_session_maker, async_session_maker
import app.models.user
import app.models.donor
import app.models.recipient
import app.models.organ
import app.models.match
import app.models.allocation
import app.models.audit
import app.models.security_event
from app.models.hospital import Hospital
from app.models.user import User, Role, Permission
from app.security.authentication import get_password_hash

HOSPITAL_A_ID = uuid.UUID("a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0")
HOSPITAL_B_ID = uuid.UUID("b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0")

PERMISSIONS = [
    "CREATE_DONOR", "VIEW_DONOR", "EDIT_DONOR",
    "CREATE_RECIPIENT", "VIEW_RECIPIENT", "EDIT_RECIPIENT",
    "VIEW_ORGAN", "EDIT_ORGAN",
    "RUN_MATCHING", "VIEW_MATCH",
    "APPROVE_ALLOCATION", "REJECT_ALLOCATION",
    "VIEW_AUDIT", "VIEW_SECURITY", "VERIFY_BLOCKCHAIN",
    "MANAGE_USERS", "MANAGE_PERMISSIONS"
]

ROLE_PERMISSIONS = {
    "ADMIN": PERMISSIONS,
    "HOSPITAL_COORDINATOR": [
        "CREATE_DONOR", "VIEW_DONOR", "EDIT_DONOR",
        "CREATE_RECIPIENT", "VIEW_RECIPIENT", "EDIT_RECIPIENT",
        "VIEW_ORGAN", "RUN_MATCHING", "VIEW_MATCH"
    ],
    "DOCTOR": [
        "VIEW_DONOR", "EDIT_DONOR",
        "VIEW_RECIPIENT", "EDIT_RECIPIENT",
        "VIEW_ORGAN", "EDIT_ORGAN"
    ],
    "ALLOCATION_AUTHORITY": [
        "VIEW_DONOR", "VIEW_RECIPIENT", "VIEW_ORGAN", "VIEW_MATCH",
        "APPROVE_ALLOCATION", "REJECT_ALLOCATION"
    ],
    "AUDITOR": [
        "VIEW_DONOR", "VIEW_RECIPIENT", "VIEW_ORGAN", "VIEW_MATCH",
        "VIEW_AUDIT", "VIEW_SECURITY", "VERIFY_BLOCKCHAIN"
    ]
}

def seed_hospitals(session: Session):
    hospitals_data = [
        {"id": HOSPITAL_A_ID, "name": "Hospital A (General Care)", "location": "New Delhi, India"},
        {"id": HOSPITAL_B_ID, "name": "Hospital B (Metropolitan)", "location": "Boston, USA"},
    ]
    for data in hospitals_data:
        existing = session.query(Hospital).filter_by(id=data["id"]).first()
        if not existing:
            hospital = Hospital(id=data["id"], name=data["name"], location=data["location"])
            session.add(hospital)
            print(f"[*] Seeded hospital: {data['name']}")
        else:
            print(f"[-] Hospital exists: {data['name']}")
    session.commit()

def seed_roles_and_permissions(session: Session):
    permission_objects = {}
    for p_name in PERMISSIONS:
        perm = session.query(Permission).filter_by(name=p_name).first()
        if not perm:
            perm = Permission(name=p_name, description=f"Permission for {p_name}")
            session.add(perm)
            session.flush()
        permission_objects[p_name] = perm

    role_objects = {}
    for r_name, p_names in ROLE_PERMISSIONS.items():
        role = session.query(Role).filter_by(name=r_name).first()
        if not role:
            role = Role(name=r_name, description=f"System Role: {r_name}")
            session.add(role)
            session.flush()
        role.permissions = [permission_objects[p] for p in p_names if p in permission_objects]
        session.flush()
        role_objects[r_name] = role

    session.commit()
    return role_objects

def seed_users(session: Session, roles_map):
    seed_password = os.getenv("SEED_USER_PASSWORD", "OrganMatch2026!")
    default_hash = get_password_hash(seed_password)

    users_data = [
        {
            "id": uuid.UUID("11111111-1111-1111-1111-111111111111"),
            "username": "admin",
            "email": "admin@organmatch.in",
            "role": "ADMIN",
            "hospital_id": HOSPITAL_A_ID,
        },
        {
            "id": uuid.UUID("22222222-2222-2222-2222-222222222222"),
            "username": "hospital",
            "email": "hospital@organmatch.in",
            "role": "HOSPITAL_COORDINATOR",
            "hospital_id": HOSPITAL_B_ID,
        },
        {
            "id": uuid.UUID("33333333-3333-3333-3333-333333333333"),
            "username": "doctor",
            "email": "doctor@organmatch.in",
            "role": "DOCTOR",
            "hospital_id": HOSPITAL_A_ID,
        },
        {
            "id": uuid.UUID("44444444-4444-4444-4444-444444444444"),
            "username": "transplant",
            "email": "transplant@organmatch.in",
            "role": "ALLOCATION_AUTHORITY",
            "hospital_id": None,
        },
        {
            "id": uuid.UUID("55555555-5555-5555-5555-555555555555"),
            "username": "auditor",
            "email": "auditor@organmatch.in",
            "role": "AUDITOR",
            "hospital_id": None,
        }
    ]

    for u_data in users_data:
        existing = session.query(User).filter_by(username=u_data["username"]).first()
        if not existing:
            user = User(
                id=u_data["id"],
                username=u_data["username"],
                email=u_data["email"],
                password_hash=default_hash,
                hospital_id=u_data["hospital_id"],
                status="Active"
            )
            if u_data["role"] in roles_map:
                user.roles.append(roles_map[u_data["role"]])
            session.add(user)
            print(f"[*] Seeded user: {u_data['username']}")
        else:
            existing.password_hash = default_hash
            existing.status = "Active"
            print(f"[*] Updated password for existing user: {u_data['username']}")

    session.commit()

async def run_async_demo_seed():
    try:
        from app.database.seed_demo import seed_demo_data
        print("[*] Running demo clinical records seeder...")
        await seed_demo_data()
        print("[*] Demo clinical records successfully seeded.")
    except Exception as e:
        print(f"[!] Warning: Demo clinical seeding notice: {e}")

def main():
    print("[*] Starting database seed routine...")
    db = sync_session_maker()
    try:
        seed_hospitals(db)
        roles = seed_roles_and_permissions(db)
        seed_users(db, roles)
        print("[*] Core hospitals, roles, and users ready.")
    finally:
        db.close()

    # Seed demo clinical records (donors, organs, recipients, matches)
    asyncio.run(run_async_demo_seed())
    print("[*] Database seeding completed successfully.")

if __name__ == "__main__":
    main()
