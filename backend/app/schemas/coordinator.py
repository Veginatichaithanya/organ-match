import uuid
from typing import List, Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel


class CoordinatorOverviewResponse(BaseModel):
    hospital_id: Optional[uuid.UUID] = None
    hospital_name: str
    active_donors: int
    available_organs: int
    active_recipients: int
    pending_medical_reviews: int
    active_matches: int
    pending_allocations: int
    recent_donors: List[Dict[str, Any]] = []
    recent_organs: List[Dict[str, Any]] = []
    recent_recipients: List[Dict[str, Any]] = []
