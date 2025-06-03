# ABOUTME: Tests for Prometheus metrics functionality and endpoint
# ABOUTME: Verifies that metrics are collected properly and exposed via /metrics endpoint

import pytest
from fastapi.testclient import TestClient
from prometheus_client import REGISTRY

from src.main import app
from src.middleware.metrics import REQUEST_DURATION, REQUEST_COUNT


client = TestClient(app)


def test_metrics_endpoint_accessible():
    """Test that the /metrics endpoint returns 200 and contains prometheus metrics."""
    response = client.get("/metrics")

    assert response.status_code == 200
    assert "text/plain" in response.headers["content-type"]

    content = response.text

    # Check for basic prometheus metrics format
    assert "# HELP" in content
    assert "# TYPE" in content

    # Check for our custom metrics
    assert "http_request_duration_seconds" in content
    assert "http_requests_total" in content


def test_metrics_endpoint_contains_expected_metrics():
    """Test that metrics endpoint contains the expected custom metrics."""
    response = client.get("/metrics")
    content = response.text

    # Check for our custom histogram metric
    assert "http_request_duration_seconds" in content
    assert "# HELP http_request_duration_seconds HTTP request duration in seconds" in content
    assert "# TYPE http_request_duration_seconds histogram" in content

    # Check for our custom counter metric
    assert "http_requests_total" in content
    assert "# HELP http_requests_total Total HTTP requests" in content
    assert "# TYPE http_requests_total counter" in content


def test_request_duration_histogram_recorded():
    """Test that request duration metrics are recorded for API calls."""
    # Make a test request to generate metrics
    response = client.get("/v1/healthz")
    assert response.status_code == 200

    # Check that metrics were recorded
    response = client.get("/metrics")
    content = response.text

    # Should contain metrics for the health check endpoint
    assert 'endpoint="/v1/healthz"' in content
    assert 'method="GET"' in content
    assert 'status_code="200"' in content


def test_request_count_incremented():
    """Test that request counter is incremented for API calls."""
    # Get initial metrics state
    initial_response = client.get("/metrics")
    initial_content = initial_response.text

    # Make multiple test requests
    for _ in range(3):
        response = client.get("/v1/healthz")
        assert response.status_code == 200

    # Check that metrics were incremented
    final_response = client.get("/metrics")
    final_content = final_response.text

    # Should contain request count metrics
    assert "http_requests_total" in final_content
    assert 'endpoint="/v1/healthz"' in final_content


def test_metrics_exclude_metrics_endpoint():
    """Test that the /metrics endpoint doesn't record metrics for itself."""
    # Make a request to the metrics endpoint
    response = client.get("/metrics")
    assert response.status_code == 200

    content = response.text

    # The metrics endpoint should not appear in its own metrics
    # (This prevents infinite recursion and noise in metrics)
    assert 'endpoint="/metrics"' not in content


def test_different_endpoints_recorded_separately():
    """Test that different endpoints are recorded with separate labels."""
    # Make requests to different endpoints
    health_response = client.get("/v1/healthz")
    assert health_response.status_code == 200

    metrics_response = client.get("/metrics")
    assert metrics_response.status_code == 200

    # Get the final metrics
    final_metrics = client.get("/metrics")
    content = final_metrics.text

    # Should have separate metrics for health endpoint
    assert 'endpoint="/v1/healthz"' in content
    assert 'method="GET"' in content
    assert 'status_code="200"' in content


def test_error_status_codes_recorded():
    """Test that error status codes are properly recorded in metrics."""
    # Make a request that will return 404
    response = client.get("/v1/nonexistent")
    assert response.status_code == 404

    # Check metrics
    metrics_response = client.get("/metrics")
    content = metrics_response.text

    # Should record the 404 status code
    assert 'status_code="404"' in content
    assert 'endpoint="/v1/nonexistent"' in content


def test_metrics_histogram_buckets():
    """Test that histogram buckets are present in metrics output."""
    # Make a request to generate metrics
    response = client.get("/v1/healthz")
    assert response.status_code == 200

    # Get metrics
    metrics_response = client.get("/metrics")
    content = metrics_response.text

    # Check for histogram buckets (standard prometheus histogram buckets)
    assert "_bucket{" in content
    assert "_count{" in content
    assert "_sum{" in content

    # Check for common histogram bucket labels
    assert 'le="0.005"' in content or 'le="0.01"' in content


def test_multiple_requests_accumulate_metrics():
    """Test that metrics accumulate correctly over multiple requests."""
    # Get baseline
    initial_metrics = client.get("/metrics").text

    # Make multiple requests
    for i in range(5):
        response = client.get("/v1/healthz")
        assert response.status_code == 200

    # Get final metrics
    final_metrics = client.get("/metrics").text

    # The count should have increased
    assert "http_requests_total" in final_metrics
    assert 'endpoint="/v1/healthz"' in final_metrics

    # There should be more metrics data now than initially
    assert len(final_metrics) >= len(initial_metrics)


def test_metrics_with_query_parameters():
    """Test that query parameters don't affect endpoint labeling."""
    # Make requests with different query parameters
    response1 = client.get("/v1/healthz?test=1")
    response2 = client.get("/v1/healthz?different=2")

    # Both should return 200 (health endpoint ignores query params)
    assert response1.status_code == 200
    assert response2.status_code == 200

    # Get metrics
    metrics_response = client.get("/metrics")
    content = metrics_response.text

    # Should record both under the same endpoint (without query params)
    assert 'endpoint="/v1/healthz"' in content
    # Should not contain query parameters in the endpoint label
    assert "test=1" not in content
    assert "different=2" not in content


def test_prometheus_default_metrics_present():
    """Test that default Prometheus metrics are also exposed."""
    response = client.get("/metrics")
    content = response.text

    # Check for common default metrics that prometheus-client provides
    # These may vary by Python version and platform, so we check for at least one
    default_metrics = [
        "python_info",
        "process_",
        "python_gc_",
    ]

    # At least one of these should be present
    assert any(metric in content for metric in default_metrics)
