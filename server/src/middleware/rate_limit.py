# ABOUTME: Rate limiting middleware using slowapi to prevent abuse and DoS attacks
# ABOUTME: Implements per-API-key and per-IP rate limiting with configurable thresholds

from fastapi import Request, HTTPException, status
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from ..middleware.auth import get_current_team


def get_rate_limit_key(request: Request) -> str:
    """
    Generate rate limit key based on API key or IP address.

    Prioritizes API key identification over IP for authenticated requests.
    Falls back to IP address for unauthenticated requests.

    Args:
        request: FastAPI request object

    Returns:
        Rate limiting key string
    """
    # Try to get authenticated user first
    auth_info = None
    try:
        # This is a sync call during rate limit check, so we can't await
        # We'll use a simpler approach and extract the API key directly
        authorization = request.headers.get("Authorization", "")
        if authorization.startswith("Bearer "):
            api_key = authorization[7:]
            if api_key:
                return f"api_key:{api_key}"
    except Exception:
        pass

    # Fall back to IP address for unauthenticated requests
    return f"ip:{get_remote_address(request)}"


# Create limiter instance
limiter = Limiter(
    key_func=get_rate_limit_key, default_limits=["60/minute"]  # Default: 60 requests per minute
)


# Custom rate limit exceeded handler that returns proper error envelope
def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """
    Handle rate limit exceeded errors with consistent error format.

    Args:
        request: FastAPI request object
        exc: RateLimitExceeded exception

    Returns:
        HTTPException with 429 status and error envelope
    """
    # Extract retry-after from the exception
    retry_after = 60

    # Return consistent error envelope format
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "error": "Rate limit exceeded. Please try again later.",
            "code": "RATE_LIMITED",
            "details": {"retry_after": retry_after, "limit": str(exc.detail)},
        },
        headers={"Retry-After": str(retry_after)},
    )


# Apply custom handler to limiter
limiter._rate_limit_exceeded_handler = custom_rate_limit_handler


class RateLimitMiddleware(SlowAPIMiddleware):
    """Custom rate limiting middleware with enhanced error handling."""

    def __init__(self, app, limiter=limiter):
        super().__init__(app, limiter)


# Rate limiting decorators for different endpoint types
def rate_limit_posts_read():
    """Rate limit decorator for read operations (GET)."""
    return limiter.limit("100/minute")  # Higher limit for reads


def rate_limit_posts_write():
    """Rate limit decorator for write operations (POST, DELETE)."""
    return limiter.limit("30/minute")  # Lower limit for writes


def rate_limit_strict():
    """Strict rate limit for sensitive operations."""
    return limiter.limit("10/minute")
