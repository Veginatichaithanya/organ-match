import uuid
from typing import Any, Dict
from fastapi import HTTPException, status
from app.models.user import User
from app.security.abac import ABACPolicy

class ABACDeniedError(HTTPException):
    """
    Exception raised when a request fails either RBAC or ABAC security policies.
    """
    def __init__(self, decision: Dict[str, Any]):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=decision["reason"]
        )
        self.decision = decision

class AuthorizationService:
    """
    Centralized service that evaluates RBAC permissions and contextual ABAC policies,
    yielding auditable decision structures.
    """
    @staticmethod
    def authorize(
        user: User,
        permission_name: str,
        resource_type: str,
        operation: str,
        resource: Any = None
    ) -> Dict[str, Any]:
        user_permissions = {p.name for r in current_user_roles(user) for p in r.permissions}

        # 1. RBAC Validation Stage
        if permission_name not in user_permissions:
            role_name = user.roles[0].name if user.roles else "guest"
            decision = {
                "allowed": False,
                "reason": f"Permission denied. Role '{role_name}' does not possess required privilege: {permission_name}.",
                "policy": "RBACPolicyMatrix",
                "actor": user.username,
                "resource": resource_type,
                "operation": operation
            }
            raise ABACDeniedError(decision)

        # 2. ABAC Validation Stage
        decision = ABACPolicy.evaluate(
            user=user,
            resource_type=resource_type,
            operation=operation,
            resource=resource
        )

        if not decision["allowed"]:
            raise ABACDeniedError(decision)

        return decision

def current_user_roles(user: User):
    """Safely extracts user roles list."""
    return user.roles if user.roles else []
