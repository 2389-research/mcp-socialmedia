# ABOUTME: Test configuration and shared fixtures for pytest
# ABOUTME: Sets up test environment and clears rate limit state between tests

import pytest
from slowapi import Limiter
from slowapi.util import get_remote_address


def get_test_rate_limit_key(request):
    """Simple rate limit key for testing that varies per test."""
    return f"test:{id(request)}"


@pytest.fixture(autouse=True)
def disable_rate_limiting(monkeypatch):
    """Disable rate limiting during tests to avoid interference."""
    # Create a limiter with very high limits for testing
    test_limiter = Limiter(
        key_func=get_test_rate_limit_key,
        default_limits=["10000/minute"]  # Very high limit for tests
    )

    # Patch the limiter in all modules that use it
    monkeypatch.setattr("src.main.limiter", test_limiter)
    monkeypatch.setattr("src.middleware.rate_limit.limiter", test_limiter)
    monkeypatch.setattr("src.routers.posts.limiter", test_limiter)

    # Also patch the app's state limiter to ensure middleware uses the test limiter
    from src.main import app
    app.state.limiter = test_limiter

    yield
