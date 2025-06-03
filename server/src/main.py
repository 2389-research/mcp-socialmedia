# ABOUTME: Main FastAPI application entry point for MCP Social Media API
# ABOUTME: Sets up the FastAPI app with middleware, routers, and configuration

import logging
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import SQLAlchemyError
import uvicorn

from .config import settings
from .routers import posts
from .database import init_db
from .middleware.rate_limit import limiter, custom_rate_limit_handler
from .middleware.error_handler import (
    http_exception_handler,
    validation_exception_handler,
    sqlalchemy_exception_handler,
    generic_exception_handler,
)
from .middleware.metrics import metrics_middleware, get_metrics
from .logging_config import setup_logging, get_logger
from .schemas import HealthResponse, ErrorResponse

# Initialize logging
setup_logging(log_level=settings.log_level, structured=settings.structured_logging)
logger = get_logger(__name__)

app = FastAPI(
    title="MCP Social Media API",
    description="""
    REST API for team-based social media posts with authentication and rate limiting.

    ## Features

    * **Team-scoped posts**: All posts belong to a specific team
    * **Authentication**: Bearer token authentication with API keys
    * **Rate limiting**: Per-API-key and per-IP rate limiting
    * **Soft deletion**: Posts are marked as deleted, not permanently removed
    * **Replies**: Support for threaded conversations with parent posts
    * **Structured logging**: JSON logs with request context
    * **Error handling**: Consistent error response format

    ## Authentication

    All endpoints except `/v1/healthz` require authentication using Bearer tokens:

    ```
    Authorization: Bearer your-api-key-here
    ```

    API keys are scoped to teams - you can only access posts for teams
    your API key has access to.
    """,
    version="1.0.0",
    openapi_url="/v1/openapi.json",
    docs_url="/v1/docs",
    redoc_url="/v1/redoc",
    contact={
        "name": "API Support",
        "url": "https://github.com/your-org/mcp-social-api",
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
)

# Add rate limiter state
app.state.limiter = limiter

# Middleware (order matters - metrics first to capture all requests)
app.middleware("http")(metrics_middleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers (order matters - most specific first)
app.add_exception_handler(RateLimitExceeded, custom_rate_limit_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(SQLAlchemyError, sqlalchemy_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# Routers
app.include_router(posts.router, prefix="/v1", tags=["Posts"])


@app.on_event("startup")
async def startup_event():
    logger.info("Application starting up", extra={"event_type": "startup"})
    await init_db()
    logger.info("Application startup complete", extra={"event_type": "startup_complete"})


@app.get(
    "/v1/healthz",
    response_model=HealthResponse,
    summary="Health check",
    description="Check the health and status of the API service",
    responses={
        200: {"description": "Service is healthy and operational"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
    },
    tags=["Health"],
)
@limiter.limit("30/minute")  # Rate limit health checks
async def health_check(request: Request):
    """
    Health check endpoint.

    Returns the current status of the API service along with build information.
    This endpoint can be used for monitoring and load balancer health checks.

    Rate limit: 30 requests per minute per IP address.
    No authentication required.
    """
    logger.debug("Health check requested", extra={"event_type": "health_check"})
    return {"status": "ok", "buildSha": settings.build_sha}


@app.get(
    "/metrics",
    summary="Prometheus metrics",
    description="Endpoint for Prometheus to scrape application metrics",
    responses={
        200: {"description": "Prometheus metrics in text format", "content": {"text/plain": {"example": "# HELP http_request_duration_seconds HTTP request duration in seconds"}}},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
    },
    tags=["Observability"],
)
@limiter.limit("60/minute")  # Allow frequent scraping
async def metrics_endpoint(request: Request):
    """
    Prometheus metrics endpoint.

    Exposes application metrics in Prometheus format for scraping.
    Includes request duration histograms, request counters, and default
    system metrics provided by the prometheus-client library.

    Rate limit: 60 requests per minute per IP address.
    No authentication required for monitoring purposes.
    """
    logger.debug("Metrics endpoint accessed", extra={"event_type": "metrics_request"})
    return get_metrics()


if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=settings.debug,
    )
