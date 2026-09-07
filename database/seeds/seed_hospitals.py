import os
import sys
import uuid
from sqlalchemy.orm import Session

# Add backend directory to sys path to import session and models
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
from app.models.hospital import Hospital

# Pre-defined UUIDs to keep seeding predictable across services
HOSPITAL_A_ID = uuid.UUID("a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0")
HOSPITAL_B_ID = uuid.UUID("b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0")

def seed_hospitals(session: Session):
    hospitals_data = [
        {"id": HOSPITAL_A_ID, "name": "Hospital A (General Care)", "location": "New York, USA"},
        {"id": HOSPITAL_B_ID, "name": "Hospital B (Metropolitan)", "location": "Boston, USA"},
    ]

    for data in hospitals_data:
        existing = session.query(Hospital).filter_by(name=data["name"]).first()
        if not existing:
            hospital = Hospital(
                id=data["id"],
                name=data["name"],
                location=data["location"]
            )
            session.add(hospital)
            print(f"Seeded hospital: {data['name']}")
        else:
            print(f"Hospital {data['name']} already exists.")
    
    session.commit()

if __name__ == "__main__":
    db = sync_session_maker()
    try:
        seed_hospitals(db)
    finally:
        db.close()
