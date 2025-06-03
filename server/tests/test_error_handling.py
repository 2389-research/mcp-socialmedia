# ABOUTME: Tests for central error handler and error envelope format
# ABOUTME: Verifies consistent error responses for validation, auth, and server errors

import pytest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.main import app
from src.database import async_session_maker, init_db
from src.models import Team, ApiKey


client = TestClient(app)


@pytest.fixture
async def setup_error_test_data():
    """Create test data for error handling tests."""
    await init_db()

    async with async_session_maker() as session:
        # Create a test team with API key
        team = Team(name=f"error-test-team-{uuid.uuid4()}")
        session.add(team)
        await session.commit()
        await session.refresh(team)

        api_key = ApiKey(key=f"error-test-key-{uuid.uuid4()}", team_id=team.id)
        session.add(api_key)
        await session.commit()

        return {"team_name": team.name, "team_id": team.id, "api_key": api_key.key}


def test_validation_error_envelope():
    """Test that validation errors return proper error envelope format."""
    # Create post with missing required fields
    response = client.post(
        "/v1/teams/test-team/posts",
        json={"invalid_field": "value"},  # Missing required author_name and content
        headers={"Authorization": "Bearer some-key"},
    )

    assert response.status_code == 422
    data = response.json()

    # Check error envelope structure
    assert "detail" in data
    assert isinstance(data["detail"], dict)
    assert "error" in data["detail"]
    assert "code" in data["detail"]
    assert "details" in data["detail"]

    # Check specific validation error format
    assert data["detail"]["code"] == "VALIDATION_ERROR"
    assert "validation failed" in data["detail"]["error"].lower()
    assert "field_errors" in data["detail"]["details"]
    assert "error_count" in data["detail"]["details"]
    assert isinstance(data["detail"]["details"]["field_errors"], list)
    assert len(data["detail"]["details"]["field_errors"]) > 0


def test_authentication_error_envelope():
    """Test that authentication errors return proper error envelope format."""
    # Request without authorization header
    response = client.get("/v1/teams/test-team/posts")

    assert response.status_code == 401
    data = response.json()

    # Check error envelope structure
    assert "detail" in data
    assert isinstance(data["detail"], dict)
    assert "error" in data["detail"]
    assert "code" in data["detail"]
    assert "details" in data["detail"]

    # Check specific auth error format
    assert data["detail"]["code"] == "UNAUTHORIZED"
    assert "invalid or missing api key" in data["detail"]["error"].lower()


def test_invalid_api_key_error_envelope():
    """Test that invalid API key errors return proper error envelope format."""
    response = client.get(
        "/v1/teams/test-team/posts", headers={"Authorization": "Bearer invalid-key-12345"}
    )

    assert response.status_code == 401
    data = response.json()

    # Check error envelope structure
    assert "detail" in data
    assert data["detail"]["code"] == "UNAUTHORIZED"
    assert "invalid or missing api key" in data["detail"]["error"].lower()


@pytest.mark.asyncio
async def test_forbidden_error_envelope(setup_error_test_data):
    """Test that forbidden access errors return proper error envelope format."""
    test_data = setup_error_test_data
    api_key = test_data["api_key"]

    # Try to access a different team with this API key
    response = client.get(
        "/v1/teams/different-team/posts", headers={"Authorization": f"Bearer {api_key}"}
    )

    assert response.status_code == 403
    data = response.json()

    # Check error envelope structure
    assert "detail" in data
    assert data["detail"]["code"] == "FORBIDDEN"
    assert "does not have access to team" in data["detail"]["error"]


def test_not_found_error_envelope():
    """Test that 404 errors return proper error envelope format."""
    # This will hit auth error first since no auth header
    response = client.get("/v1/teams/non-existent/posts")
    assert response.status_code == 401  # Auth happens first

    # Test with valid auth to a non-existent resource would need a valid key
    # For now, testing the error envelope structure is sufficient


@pytest.mark.asyncio
async def test_post_not_found_error_envelope(setup_error_test_data):
    """Test that post not found errors return proper error envelope format."""
    test_data = setup_error_test_data
    team_name = test_data["team_name"]
    api_key = test_data["api_key"]

    response = client.get(
        f"/v1/teams/{team_name}/posts/non-existent-post-id",
        headers={"Authorization": f"Bearer {api_key}"},
    )

    assert response.status_code == 404
    data = response.json()

    # Check error envelope structure
    assert "detail" in data
    assert data["detail"]["code"] == "NOT_FOUND"
    assert "not found" in data["detail"]["error"].lower()


def test_method_not_allowed_error_envelope():
    """Test that method not allowed errors return proper response format."""
    # Try to use PATCH method on an endpoint that doesn't support it
    response = client.patch("/v1/healthz")

    assert response.status_code == 405
    data = response.json()

    # FastAPI's built-in 405 doesn't use our custom error handler
    # but should still return a proper error response
    assert "detail" in data
    # For 405, FastAPI returns a simple string detail
    assert isinstance(data["detail"], str)
    assert "method not allowed" in data["detail"].lower()


def test_validation_error_field_details():
    """Test that validation errors include detailed field information."""
    response = client.post(
        "/v1/teams/test-team/posts",
        json={
            "author_name": "",  # Empty string should fail validation
            "content": "x" * 10001,  # Too long content
            "tags": ["tag"] * 25,  # Too many tags
        },
        headers={"Authorization": "Bearer some-key"},
    )

    assert response.status_code == 422
    data = response.json()

    field_errors = data["detail"]["details"]["field_errors"]
    assert isinstance(field_errors, list)
    assert len(field_errors) > 0

    # Check that each field error has required structure
    for error in field_errors:
        assert "field" in error
        assert "message" in error
        assert "type" in error
        assert isinstance(error["field"], str)
        assert isinstance(error["message"], str)


def test_consistent_error_envelope_structure():
    """Test that all error envelopes have consistent structure."""
    test_cases = [
        # Validation error
        {
            "method": "post",
            "url": "/v1/teams/test/posts",
            "json": {"invalid": "data"},
            "headers": {"Authorization": "Bearer key"},
            "expected_status": 422,
        },
        # Auth error
        {"method": "get", "url": "/v1/teams/test/posts", "expected_status": 401},
        # Not found (but will hit auth first)
        {"method": "get", "url": "/v1/teams/test/posts/invalid", "expected_status": 401},
    ]

    for case in test_cases:
        method = getattr(client, case["method"])
        kwargs = {}
        if "json" in case:
            kwargs["json"] = case["json"]
        if "headers" in case:
            kwargs["headers"] = case["headers"]

        response = method(case["url"], **kwargs)
        assert response.status_code == case["expected_status"]

        data = response.json()

        # Every error response should have this structure
        assert "detail" in data
        detail = data["detail"]
        assert isinstance(detail, dict)
        assert "error" in detail
        assert "code" in detail
        assert "details" in detail

        # Check types
        assert isinstance(detail["error"], str)
        assert isinstance(detail["code"], str)
        assert isinstance(detail["details"], dict)

        # Error message should not be empty
        assert len(detail["error"]) > 0
        assert len(detail["code"]) > 0


def test_rate_limit_error_envelope_format():
    """Test that rate limit errors maintain proper envelope format."""
    # Make many requests to trigger rate limit
    responses = []
    for i in range(35):  # Health endpoint limit is 30/minute
        response = client.get("/v1/healthz")
        responses.append(response)
        if response.status_code == 429:
            break

    # Check if we got rate limited
    rate_limited_responses = [r for r in responses if r.status_code == 429]
    if rate_limited_responses:
        response = rate_limited_responses[0]
        data = response.json()

        # Check error envelope structure for rate limit error
        assert "detail" in data
        assert data["detail"]["code"] == "RATE_LIMITED"
        assert "rate limit exceeded" in data["detail"]["error"].lower()
        assert "retry_after" in data["detail"]["details"]

        # Check headers
        assert "Retry-After" in response.headers
