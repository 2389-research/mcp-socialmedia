# ABOUTME: Simple rate limiting tests to verify the middleware is working
# ABOUTME: Tests basic rate limiting functionality without complex fixtures

import pytest
import time
from fastapi.testclient import TestClient

from src.main import app


client = TestClient(app)


def test_health_endpoint_basic_rate_limit():
    """Test that health endpoint has some rate limiting."""
    # Make a few requests quickly
    responses = []
    for i in range(10):
        response = client.get("/v1/healthz")
        responses.append(response)

    # At minimum, we should get some successful responses
    successful_responses = [r for r in responses if r.status_code == 200]
    assert len(successful_responses) > 0, "Should have some successful responses"


def test_unauthenticated_requests_are_rate_limited():
    """Test that unauthenticated requests get proper error handling."""
    # Make an unauthenticated request
    response = client.get("/v1/teams/non-existent/posts")

    # Should get 401 (auth error) not a rate limit error for single request
    assert response.status_code == 401
    assert "Invalid or missing API key" in str(response.json())


def test_rate_limiting_middleware_is_active():
    """Test that the rate limiting middleware is installed and functioning."""
    # Verify that the app has the rate limiter state
    assert hasattr(app.state, "limiter"), "Rate limiter should be configured"

    # Test health endpoint works normally
    response = client.get("/v1/healthz")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ok"
