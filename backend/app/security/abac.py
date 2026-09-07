from typing import Any, Dict, Optional
import uuid
from app.models.user import User

class ABACPolicy:
    """
    Evaluates context attributes (requester ID, role, hospital ID, operational targets,
    and actions) to determine if a request conforms to system safety regulations.
    """
    @staticmethod
    def evaluate(
        user: User,
        resource_type: str,
        operation: str, # "CREATE" | "READ" | "UPDATE" | "DELETE" | "APPROVE" | "REJECT" | "RUN_MATCHING"
        resource: Any = None
    ) -> Dict[str, Any]:
        # Initialize decision object template
        decision = {
            "allowed": False,
            "reason": "Default policy rejection.",
            "policy": "DefaultDeny",
            "actor": user.username,
            "resource": resource_type,
            "operation": operation
        }

        # Retrieve user roles
        role_name = user.roles[0].name if user.roles else "guest"

        # 1. ADMIN bypass
        if role_name == "ADMIN":
            decision["allowed"] = True
            decision["reason"] = "Admin override allowed."
            decision["policy"] = "AdminBypass"
            return decision

        # 2. AUDITOR block on write operations
        if role_name == "AUDITOR":
            if operation in ["CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT", "RUN_MATCHING"]:
                decision["allowed"] = False
                decision["reason"] = f"Auditors are restricted to read-only operations. Operation '{operation}' is blocked."
                decision["policy"] = "AuditorReadOnlyPolicy"
                return decision
            else:
                decision["allowed"] = True
                decision["reason"] = "Auditor query allowed."
                decision["policy"] = "AuditorReadOnlyPolicy"
                return decision

        # 3. ABAC checks for Hospital Coordinators and Doctors
        if role_name in ["HOSPITAL_COORDINATOR", "DOCTOR"]:
            # Doctors are strictly read/assess only and cannot delete records
            if role_name == "DOCTOR" and operation == "DELETE":
                decision["allowed"] = False
                decision["reason"] = f"Doctors are not authorized to delete entity records."
                decision["policy"] = "DoctorNoDeletePolicy"
                return decision

            # Verification: Hospital coordinators and doctors can only check or modify records belonging to their hospital
            user_hospital_id = user.hospital_id
            if not user_hospital_id:
                decision["allowed"] = False
                decision["reason"] = "User does not have an assigned hospital context."
                decision["policy"] = "HospitalScopePolicy"
                return decision

            # Evaluation for Donor/Recipient entities
            if resource_type in ["Donor", "Recipient"]:
                # For CREATE requests, the resource is the payload dict containing target hospital_id
                if operation == "CREATE" and isinstance(resource, dict):
                    target_hospital_id = resource.get("hospital_id")
                    # Convert to UUID if it's string format
                    if isinstance(target_hospital_id, str):
                        target_hospital_id = uuid.UUID(target_hospital_id)
                    
                    if user_hospital_id != target_hospital_id:
                        decision["allowed"] = False
                        decision["reason"] = "Cannot register a record under a different hospital context."
                        decision["policy"] = "HospitalScopePolicy"
                        return decision
                    
                    decision["allowed"] = True
                    decision["reason"] = "Local hospital creation authorized."
                    decision["policy"] = "HospitalScopePolicy"
                    return decision

                # For READ/UPDATE operations, compare against database entity hospital_id attribute
                if resource:
                    record_hospital_id = getattr(resource, "hospital_id", None)
                    if record_hospital_id and user_hospital_id != record_hospital_id:
                        decision["allowed"] = False
                        decision["reason"] = f"Operation '{operation}' denied. This record belongs to another hospital."
                        decision["policy"] = "HospitalScopePolicy"
                        return decision
                    
                decision["allowed"] = True
                decision["reason"] = "Local hospital access authorized."
                decision["policy"] = "HospitalScopePolicy"
                return decision

            # Evaluation for Organ entities
            if resource_type == "Organ":
                if resource:
                    # An organ inherits hospital ownership from its donor
                    donor = getattr(resource, "donor", None)
                    donor_hospital_id = getattr(donor, "hospital_id", None) if donor else None
                    if donor_hospital_id and user_hospital_id != donor_hospital_id:
                        decision["allowed"] = False
                        decision["reason"] = "Access denied. Organ donor belongs to another hospital."
                        decision["policy"] = "HospitalScopePolicy"
                        return decision

                decision["allowed"] = True
                decision["reason"] = "Organ access authorized."
                decision["policy"] = "HospitalScopePolicy"
                return decision

            # Allocation and Match restrictions for Coordinator
            if resource_type in ["Match", "Allocation"]:
                if operation in ["APPROVE", "REJECT"]:
                    decision["allowed"] = False
                    decision["reason"] = "Role does not hold transplant allocation authority permissions."
                    decision["policy"] = "AllocationAuthorityPolicy"
                    return decision
                
                # Reading is allowed for hospital matches/allocations
                decision["allowed"] = True
                decision["reason"] = "Local hospital match monitoring permitted."
                decision["policy"] = "HospitalScopePolicy"
                return decision

        # 4. ABAC checks for Transplant Allocation Authority
        if role_name == "ALLOCATION_AUTHORITY":
            # Can run matches and review allocations globally, but cannot create donors or recipients
            if resource_type in ["Donor", "Recipient"] and operation in ["CREATE", "UPDATE", "DELETE"]:
                decision["allowed"] = False
                decision["reason"] = "Transplant Center role cannot modify raw donor or recipient registration records."
                decision["policy"] = "TransplantRoleScopePolicy"
                return decision
            
            decision["allowed"] = True
            decision["reason"] = "Global allocation review authorized."
            decision["policy"] = "TransplantRoleScopePolicy"
            return decision

        return decision
