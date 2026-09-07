from fastapi import Depends, HTTPException, status
from app.security.authentication import get_current_user
from app.models.user import User

class PermissionDeniedError(HTTPException):
    """
    Exception raised when a user does not possess the required RBAC permission.
    """
    def __init__(self, permission_name: str, username: str = "Unknown"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Missing required permission: {permission_name}."
        )
        self.permission_name = permission_name
        self.username = username

class RequirePermission:
    """
    Dependency helper that verifies if the current user possesses the required permission.
    """
    def __init__(self, permission_name: str):
        self.permission_name = permission_name

    async def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        # Collect deduplicated set of permission strings from all assigned roles
        user_permissions = {p.name for r in current_user.roles for p in r.permissions}
        
        if self.permission_name not in user_permissions:
            raise PermissionDeniedError(
                permission_name=self.permission_name,
                username=current_user.username
            )
        return current_user
