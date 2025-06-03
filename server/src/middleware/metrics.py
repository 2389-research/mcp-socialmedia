# ABOUTME: Prometheus metrics middleware for tracking request durations and exposing metrics
# ABOUTME: Provides request duration histograms per route and default system metrics

import time
from typing import Callable
from fastapi import Request, Response
from prometheus_client import Histogram, Counter, generate_latest, CONTENT_TYPE_LATEST

# Request duration histogram with labels for method and endpoint
REQUEST_DURATION = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint', 'status_code']
)

# Request counter
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status_code']
)


async def metrics_middleware(request: Request, call_next: Callable) -> Response:
    """
    Middleware to track request metrics.

    Records request duration and count for each endpoint, method, and status code.
    """
    # Skip metrics collection for the metrics endpoint itself to avoid recursion
    if request.url.path == "/metrics":
        return await call_next(request)

    # Record start time
    start_time = time.time()

    # Process the request
    response = await call_next(request)

    # Calculate duration
    duration = time.time() - start_time

    # Extract endpoint path (remove query parameters and normalize)
    endpoint = request.url.path
    method = request.method
    status_code = str(response.status_code)

    # Record metrics
    REQUEST_DURATION.labels(
        method=method,
        endpoint=endpoint,
        status_code=status_code
    ).observe(duration)

    REQUEST_COUNT.labels(
        method=method,
        endpoint=endpoint,
        status_code=status_code
    ).inc()

    return response


def get_metrics() -> Response:
    """
    Generate Prometheus metrics in the expected format.

    Returns metrics data that can be scraped by Prometheus.
    """
    metrics_data = generate_latest()
    return Response(
        content=metrics_data,
        media_type=CONTENT_TYPE_LATEST
    )
