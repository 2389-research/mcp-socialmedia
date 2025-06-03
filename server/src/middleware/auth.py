# ABOUTME: Authentication middleware for Bearer token validation
# ABOUTME: Validates API keys and attaches team information to requests

from typing import Optional
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import async_session_maker
from ..models import ApiKey, Team
from ..logging_config import get_logger, mask_api_key

logger = get_logger(__name__)


security = HTTPBearer()


class AuthenticatedRequest:
    """Container for authenticated request information."""

    def __init__(self, team_id: str, team_name: str, api_key: str):
        self.team_id = team_id
        self.team_name = team_name
        self.api_key = api_key


async def get_current_team(request: Request) -> Optional[AuthenticatedRequest]:
    """
    Extract and validate API key from request headers.

    Returns:
        AuthenticatedRequest if valid API key, None otherwise
    """
    # Get Authorization header
    authorization = request.headers.get("Authorization")
    if not authorization:
        return None

    # Check Bearer token format
    if not authorization.startswith("Bearer "):
        return None

    api_key = authorization[7:]  # Remove "Bearer " prefix
    if not api_key:
        return None

    # Look up API key in database
    async with async_session_maker() as session:
        query = (
            select(ApiKey, Team).join(Team, ApiKey.team_id == Team.id).where(ApiKey.key == api_key)
        )
        result = await session.execute(query)
        api_key_data = result.first()

        if not api_key_data:
            logger.warning(
                "Invalid API key attempted",
                extra={
                    "event_type": "auth_failure",
                    "api_key_masked": mask_api_key(api_key),
                    "request_path": request.url.path,
                    "request_method": request.method,
                },
            )
            return None

        api_key_obj, team = api_key_data
        logger.debug(
            "API key authenticated successfully",
            extra={
                "event_type": "auth_success",
                "team_name": team.name,
                "api_key_masked": mask_api_key(api_key),
                "request_path": request.url.path,
                "request_method": request.method,
            },
        )
        return AuthenticatedRequest(team_id=team.id, team_name=team.name, api_key=api_key_obj.key)


async def require_authentication(request: Request) -> AuthenticatedRequest:
    """
    Require valid authentication for the request.

    Raises:
        HTTPException: 401 if authentication is missing or invalid

    Returns:
        AuthenticatedRequest with team information
    """
    auth_info = await get_current_team(request)
    if not auth_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return auth_info


async def require_team_access(request: Request, team_name: str) -> AuthenticatedRequest:
    """
    Require authentication and verify access to specific team.

    Args:
        request: FastAPI request object
        team_name: Name of team being accessed

    Raises:
        HTTPException: 401 if auth invalid, 403 if wrong team

    Returns:
        AuthenticatedRequest with team information
    """
    auth_info = await require_authentication(request)

    if auth_info.team_name != team_name:
        logger.warning(
            "Team access denied",
            extra={
                "event_type": "team_access_denied",
                "requested_team": team_name,
                "authorized_team": auth_info.team_name,
                "api_key_masked": mask_api_key(auth_info.api_key),
                "request_path": request.url.path,
                "request_method": request.method,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"API key does not have access to team '{team_name}'",
        )

    return auth_info
