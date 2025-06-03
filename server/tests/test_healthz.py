# ABOUTME: Integration tests for the health check endpoint
# ABOUTME: Verifies that the API server is running and responding correctly

import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)


def test_health_check():
    """Test that health check endpoint returns correct response."""
    response = client.get("/v1/healthz")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "buildSha" in data
    assert data["status"] == "ok"
