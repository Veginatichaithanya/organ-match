import os
import sys
import uuid
import secrets
from sqlalchemy.orm import Session

# Add backend directory to sys path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend")))

from app.database.session import sync_session_maker
import app.models.user
import app.models.donor
import app.models.recipient
import app.models.organ
import app.models.match
import app.models.allocation
import app.models.audit
import app.models.security_event
from app.models.user import User, Role, Permission
from app.security.authentication import get_password_hash
from seed_hospitals import HOSPITAL_A_ID, HOSPITAL_B_ID

# Define system permissions
PERMISSIONS = [
    "CREATE_DONOR", "VIEW_DONOR", "EDIT_DONOR",
    "CREATE_RECIPIENT", "VIEW_RECIPIENT", "EDIT_RECIPIENT",
    "VIEW_ORGAN", "EDIT_ORGAN",
    "RUN_MATCHING", "VIEW_MATCH",
    "APPROVE_ALLOCATION", "REJECT_ALLOCATION",
    "VIEW_AUDIT", "VIEW_SECURITY", "VERIFY_BLOCKCHAIN",
    "MANAGE_USERS", "MANAGE_PERMISSIONS"
]

# Define roles and their corresponding permissions mappings
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

def seed_roles_and_permissions(session: Session):
    # 1. Seed Permissions
    permission_objects = {}
    for p_name in PERMISSIONS:
        perm = session.query(Permission).filter_by(name=p_name).first()
        if not perm:
            perm = Permission(name=p_name, description=f"Allows {p_name.lower().replace('_', ' ')}")
            session.add(perm)
            session.flush()
            print(f"Created permission: {p_name}")
        permission_objects[p_name] = perm

    # 2. Seed Roles and map permissions
    role_objects = {}
    for r_name, p_names in ROLE_PERMISSIONS.items():
        role = session.query(Role).filter_by(name=r_name).first()
        if not role:
            role = Role(name=r_name, description=f"System {r_name.lower().replace('_', ' ')}")
            session.add(role)
            session.flush()
            print(f"Created role: {r_name}")
        
        # Link permissions to role
        role.permissions = [permission_objects[p] for p in p_names]
        session.flush()
        role_objects[r_name] = role

    session.commit()
    return role_objects

def seed_users(session: Session, roles_map):
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

    seed_password = os.getenv("SEED_USER_PASSWORD") or secrets.token_urlsafe(16)
    default_hash = get_password_hash(seed_password)

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
            # Assign role
            user.roles.append(roles_map[u_data["role"]])
            session.add(user)
            print(f"Seeded user: {u_data['username']}")
        else:
            print(f"User {u_data['username']} already exists.")
            
    session.commit()

if __name__ == "__main__":
    db = sync_session_maker()
    try:
        roles = seed_roles_and_permissions(db)
        seed_users(db, roles)
    finally:
        db.close()
