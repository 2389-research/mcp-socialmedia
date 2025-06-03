# ABOUTME: Central error handler middleware for consistent error responses
# ABOUTME: Captures and formats various error types into standardized error envelopes

import logging
import traceback
from typing import Dict, Any
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from pydantic import ValidationError

# Set up structured logger
logger = logging.getLogger(__name__)


def create_error_envelope(
    error: str, code: str, details: Dict[str, Any] = None, status_code: int = 500
) -> Dict[str, Any]:
    """
    Create a standardized error envelope.

    Args:
        error: Human-readable error message
        code: Error code for programmatic handling
        details: Additional error details
        status_code: HTTP status code

    Returns:
        Standardized error envelope dictionary
    """
    envelope = {"error": error, "code": code, "details": details or {}}

    # Add status code to details for debugging
    envelope["details"]["status_code"] = status_code

    return envelope


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """
    Handle HTTP exceptions with consistent error format.

    Args:
        request: FastAPI request object
        exc: HTTPException instance

    Returns:
        JSONResponse with error envelope
    """
    # If detail is already an error envelope, use it as-is
    if isinstance(exc.detail, dict) and "error" in exc.detail and "code" in exc.detail:
        error_envelope = exc.detail
    else:
        # Convert string detail to error envelope
        error_code = _get_error_code_for_status(exc.status_code)
        error_envelope = create_error_envelope(
            error=str(exc.detail), code=error_code, status_code=exc.status_code
        )

    # Log the error
    logger.warning(
        "HTTP exception occurred",
        extra={
            "status_code": exc.status_code,
            "error_code": error_envelope.get("code"),
            "error_message": error_envelope.get("error"),
            "request_path": request.url.path,
            "request_method": request.method,
        },
    )

    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": error_envelope},
        headers=getattr(exc, "headers", None),
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """
    Handle Pydantic validation errors with detailed error information.

    Args:
        request: FastAPI request object
        exc: RequestValidationError instance

    Returns:
        JSONResponse with validation error envelope
    """
    # Extract field-specific validation errors
    field_errors = []
    for error in exc.errors():
        field_path = " -> ".join(str(loc) for loc in error["loc"])
        field_errors.append({"field": field_path, "message": error["msg"], "type": error["type"]})

    error_envelope = create_error_envelope(
        error="Validation failed. Please check your input data.",
        code="VALIDATION_ERROR",
        details={"field_errors": field_errors, "error_count": len(field_errors)},
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
    )

    # Log validation errors
    logger.warning(
        "Validation error occurred",
        extra={
            "request_path": request.url.path,
            "request_method": request.method,
            "error_count": len(field_errors),
            "field_errors": field_errors,
        },
    )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content={"detail": error_envelope}
    )


async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """
    Handle SQLAlchemy database errors.

    Args:
        request: FastAPI request object
        exc: SQLAlchemyError instance

    Returns:
        JSONResponse with database error envelope
    """
    if isinstance(exc, IntegrityError):
        # Handle constraint violations (unique, foreign key, etc.)
        error_envelope = create_error_envelope(
            error="Database constraint violation. The requested operation conflicts with existing data.",
            code="INTEGRITY_ERROR",
            details={
                "constraint_type": "integrity_constraint",
                "database_error": str(exc.orig) if hasattr(exc, "orig") else str(exc),
            },
            status_code=status.HTTP_409_CONFLICT,
        )
        status_code = status.HTTP_409_CONFLICT
    else:
        # Generic database error
        error_envelope = create_error_envelope(
            error="A database error occurred. Please try again later.",
            code="DATABASE_ERROR",
            details={"database_error": str(exc)},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR

    # Log database errors
    logger.error(
        "Database error occurred",
        extra={
            "request_path": request.url.path,
            "request_method": request.method,
            "exception_type": type(exc).__name__,
            "error_details": str(exc),
        },
    )

    return JSONResponse(status_code=status_code, content={"detail": error_envelope})


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Handle unexpected exceptions with generic error response.

    Args:
        request: FastAPI request object
        exc: Exception instance

    Returns:
        JSONResponse with generic error envelope
    """
    error_envelope = create_error_envelope(
        error="An unexpected error occurred. Please try again later.",
        code="INTERNAL_ERROR",
        details={"exception_type": type(exc).__name__, "exception_message": str(exc)},
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )

    # Log unexpected errors with full traceback
    logger.error(
        "Unexpected error occurred",
        extra={
            "request_path": request.url.path,
            "request_method": request.method,
            "exception_type": type(exc).__name__,
            "exception_message": str(exc),
            "traceback": traceback.format_exc(),
        },
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"detail": error_envelope}
    )


def _get_error_code_for_status(status_code: int) -> str:
    """
    Map HTTP status codes to error codes.

    Args:
        status_code: HTTP status code

    Returns:
        Corresponding error code string
    """
    status_map = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        409: "CONFLICT",
        422: "VALIDATION_ERROR",
        429: "RATE_LIMITED",
        500: "INTERNAL_ERROR",
        502: "BAD_GATEWAY",
        503: "SERVICE_UNAVAILABLE",
    }
    return status_map.get(status_code, "UNKNOWN_ERROR")
