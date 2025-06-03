# ABOUTME: Tests for Docker configuration files and deployment setup
# ABOUTME: Validates Dockerfile, docker-compose.yml, and deployment scripts

import pytest
import yaml
import os
from pathlib import Path


def test_dockerfile_exists_and_valid():
    """Test that Dockerfile exists and has expected content."""
    dockerfile_path = Path(__file__).parent.parent / "Dockerfile"
    assert dockerfile_path.exists(), "Dockerfile should exist"

    content = dockerfile_path.read_text()

    # Check for multi-stage build
    assert "FROM python:3.13-slim as builder" in content
    assert "FROM python:3.13-slim as runtime" in content

    # Check for security features
    assert "useradd -r" in content, "Should create non-root user"
    assert "USER appuser" in content, "Should switch to non-root user"

    # Check for required components
    assert "COPY src/" in content, "Should copy source code"
    assert "COPY alembic/" in content, "Should copy migration files"
    assert "HEALTHCHECK" in content, "Should include health check"
    assert "EXPOSE" in content, "Should expose port"

    # Check for proper CMD
    assert "alembic upgrade head" in content, "Should run migrations"
    assert "uvicorn src.main:app" in content, "Should start the app"


def test_docker_compose_exists_and_valid():
    """Test that docker-compose.yml exists and has valid structure."""
    compose_path = Path(__file__).parent.parent / "docker-compose.yml"
    assert compose_path.exists(), "docker-compose.yml should exist"

    with open(compose_path) as f:
        compose_config = yaml.safe_load(f)

    # Check basic structure
    assert "services" in compose_config
    assert "api" in compose_config["services"]

    api_service = compose_config["services"]["api"]

    # Check essential configuration
    assert "build" in api_service, "Should have build configuration"
    assert "ports" in api_service, "Should expose ports"
    assert "environment" in api_service, "Should have environment variables"
    assert "volumes" in api_service, "Should have volume mounts"
    assert "healthcheck" in api_service, "Should have health check"

    # Check port mapping
    assert "8000:8000" in api_service["ports"][0], "Should map port 8000"

    # Check essential environment variables
    env_vars = api_service["environment"]
    env_var_names = [var.split("=")[0] for var in env_vars]

    required_env_vars = ["PORT", "BUILD_SHA", "DATABASE_URL", "LOG_LEVEL"]
    for var in required_env_vars:
        assert any(var in env_var for env_var in env_var_names), f"Should have {var} environment variable"


def test_github_actions_workflow_exists():
    """Test that GitHub Actions workflow exists and has required jobs."""
    workflow_path = Path(__file__).parent.parent / ".github" / "workflows" / "ci.yml"
    assert workflow_path.exists(), "CI workflow should exist"

    with open(workflow_path) as f:
        workflow = yaml.safe_load(f)

    # Check basic structure
    assert "name" in workflow
    assert "jobs" in workflow
    # "on" gets parsed as boolean True in YAML, so check for trigger events
    assert True in workflow or "on" in workflow

    jobs = workflow["jobs"]

    # Check for required jobs
    required_jobs = ["test", "security", "docker", "smoke-test"]
    for job in required_jobs:
        assert job in jobs, f"Should have {job} job"

    # Check test job has required steps
    test_job = jobs["test"]
    assert "steps" in test_job

    step_names = [step.get("name", "") for step in test_job["steps"]]
    assert any("test" in name.lower() for name in step_names), "Should have testing step"
    assert any("lint" in name.lower() for name in step_names), "Should have linting step"


def test_deployment_script_exists_and_executable():
    """Test that deployment script exists and is executable."""
    script_path = Path(__file__).parent.parent / "scripts" / "deploy.sh"
    assert script_path.exists(), "Deployment script should exist"

    # Check if file is executable (on Unix systems)
    if os.name != 'nt':  # Not Windows
        stat = script_path.stat()
        assert stat.st_mode & 0o111, "Script should be executable"

    content = script_path.read_text()

    # Check for essential functions
    assert "wait_for_health()" in content, "Should have health check function"
    assert "run_smoke_tests()" in content, "Should have smoke test function"
    assert "deploy()" in content, "Should have deploy function"
    assert "rollback()" in content, "Should have rollback function"

    # Check for safety features
    assert "set -euo pipefail" in content, "Should have bash safety flags"


def test_docker_configuration_environment_variables():
    """Test that Docker environment variables are properly configured."""
    compose_path = Path(__file__).parent.parent / "docker-compose.yml"

    with open(compose_path) as f:
        compose_config = yaml.safe_load(f)

    api_service = compose_config["services"]["api"]
    env_vars = api_service["environment"]

    # Convert to dict for easier checking
    env_dict = {}
    for var in env_vars:
        if "=" in var:
            key, value = var.split("=", 1)
            env_dict[key] = value
        else:
            # Variable without default value
            env_dict[var] = None

    # Check database URL points to volume mount
    assert "sqlite:///app/data/" in env_dict.get("DATABASE_URL", ""), \
        "Database should be in mounted volume"

    # Check default port
    assert env_dict.get("PORT") == "8000", "Should default to port 8000"


def test_docker_volume_mounts():
    """Test that Docker volumes are properly configured for persistence."""
    compose_path = Path(__file__).parent.parent / "docker-compose.yml"

    with open(compose_path) as f:
        compose_config = yaml.safe_load(f)

    api_service = compose_config["services"]["api"]
    volumes = api_service["volumes"]

    # Check for essential volume mounts
    volume_mounts = [vol.split(":")[1] if ":" in vol else vol for vol in volumes]

    assert "/app/data" in volume_mounts, "Should mount data directory"
    assert "/app/logs" in volume_mounts, "Should mount logs directory"


def test_health_check_configuration():
    """Test that health check is properly configured."""
    compose_path = Path(__file__).parent.parent / "docker-compose.yml"

    with open(compose_path) as f:
        compose_config = yaml.safe_load(f)

    api_service = compose_config["services"]["api"]
    healthcheck = api_service["healthcheck"]

    # Check health check configuration
    assert "test" in healthcheck, "Should have health check test"
    assert "interval" in healthcheck, "Should have health check interval"
    assert "timeout" in healthcheck, "Should have health check timeout"
    assert "retries" in healthcheck, "Should have health check retries"

    # Check that health check hits the right endpoint
    test_command = " ".join(healthcheck["test"])
    assert "/v1/healthz" in test_command, "Should check health endpoint"


def test_project_structure_for_docker():
    """Test that project structure is compatible with Docker build."""
    project_root = Path(__file__).parent.parent

    # Check for essential files that Docker needs
    required_files = [
        "src/main.py",
        "src/config.py",
        "alembic.ini",
        "pyproject.toml"
    ]

    for file_path in required_files:
        assert (project_root / file_path).exists(), f"Required file {file_path} should exist"

    # Check for essential directories
    required_dirs = [
        "src",
        "alembic",
        "tests"
    ]

    for dir_path in required_dirs:
        assert (project_root / dir_path).is_dir(), f"Required directory {dir_path} should exist"
