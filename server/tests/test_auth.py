# ABOUTME: Integration tests for Bearer token authentication middleware
# ABOUTME: Tests authentication, authorization, and team access control

import pytest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.main import app
from src.database import async_session_maker, init_db
from src.models import Team, Post, ApiKey


client = TestClient(app)


@pytest.fixture(scope="function")
async def setup_auth_test_data():
    """Create test data with teams and API keys for auth tests."""
    await init_db()
    
    async with async_session_maker() as session:
        # Create first team with API key
        team1 = Team(name=f"team1-{uuid.uuid4()}")
        session.add(team1)
        await session.commit()
        await session.refresh(team1)
        
        api_key1 = ApiKey(key=f"valid-key-team1-{uuid.uuid4()}", team_id=team1.id)
        session.add(api_key1)
        
        # Create second team with API key
        team2 = Team(name=f"team2-{uuid.uuid4()}")
        session.add(team2)
        await session.commit()
        await session.refresh(team2)
        
        api_key2 = ApiKey(key=f"valid-key-team2-{uuid.uuid4()}", team_id=team2.id)
        session.add(api_key2)
        
        # Create some posts for team1
        post1 = Post(
            team_id=team1.id,
            author_name="alice",
            content="Team 1 post",
            tags=["team1"]
        )
        session.add(post1)
        
        await session.commit()
        
        yield {
            "team1_name": team1.name,
            "team1_id": team1.id,
            "team1_key": api_key1.key,
            "team2_name": team2.name,
            "team2_id": team2.id,
            "team2_key": api_key2.key,
            "post1_id": post1.id
        }


def test_no_auth_header():
    """Test that requests without Authorization header are rejected."""
    response = client.get("/v1/teams/demo/posts")
    assert response.status_code == 401
    assert "Invalid or missing API key" in response.json()["detail"]


def test_invalid_auth_header_format():
    """Test that malformed Authorization headers are rejected."""
    # No Bearer prefix
    response = client.get("/v1/teams/demo/posts", headers={"Authorization": "invalid-key"})
    assert response.status_code == 401
    
    # Empty Bearer
    response = client.get("/v1/teams/demo/posts", headers={"Authorization": "Bearer "})
    assert response.status_code == 401
    
    # Wrong prefix
    response = client.get("/v1/teams/demo/posts", headers={"Authorization": "Basic invalid"})
    assert response.status_code == 401


def test_invalid_api_key():
    """Test that invalid API keys are rejected."""
    headers = {"Authorization": "Bearer invalid-api-key-12345"}
    response = client.get("/v1/teams/demo/posts", headers=headers)
    assert response.status_code == 401
    assert "Invalid or missing API key" in response.json()["detail"]


@pytest.mark.asyncio
async def test_valid_authentication(setup_auth_test_data):
    """Test that valid API keys allow access to correct team."""
    test_data = setup_auth_test_data
    team1_name = test_data["team1_name"]
    team1_key = test_data["team1_key"]
    
    headers = {"Authorization": f"Bearer {team1_key}"}
    response = client.get(f"/v1/teams/{team1_name}/posts", headers=headers)
    assert response.status_code == 200
    
    data = response.json()
    assert "posts" in data
    assert "total" in data
    assert "has_more" in data


@pytest.mark.asyncio
async def test_cross_team_access_forbidden(setup_auth_test_data):
    """Test that API keys cannot access other teams."""
    test_data = setup_auth_test_data
    team1_name = test_data["team1_name"]
    team2_name = test_data["team2_name"]
    team1_key = test_data["team1_key"]
    
    # Try to access team2 with team1's API key
    headers = {"Authorization": f"Bearer {team1_key}"}
    response = client.get(f"/v1/teams/{team2_name}/posts", headers=headers)
    assert response.status_code == 403
    assert f"API key does not have access to team '{team2_name}'" in response.json()["detail"]


@pytest.mark.asyncio
async def test_all_endpoints_require_auth(setup_auth_test_data):
    """Test that all team endpoints require authentication."""
    test_data = setup_auth_test_data
    team1_name = test_data["team1_name"]
    post_id = test_data["post1_id"]
    
    # List posts
    response = client.get(f"/v1/teams/{team1_name}/posts")
    assert response.status_code == 401
    
    # Create post
    post_data = {"author_name": "test", "content": "test content"}
    response = client.post(f"/v1/teams/{team1_name}/posts", json=post_data)
    assert response.status_code == 401
    
    # Get single post
    response = client.get(f"/v1/teams/{team1_name}/posts/{post_id}")
    assert response.status_code == 401
    
    # Delete post
    response = client.delete(f"/v1/teams/{team1_name}/posts/{post_id}")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_authenticated_create_post(setup_auth_test_data):
    """Test creating a post with valid authentication."""
    test_data = setup_auth_test_data
    team1_name = test_data["team1_name"]
    team1_key = test_data["team1_key"]
    
    headers = {"Authorization": f"Bearer {team1_key}"}
    post_data = {
        "author_name": "authenticated-user",
        "content": "This post was created with authentication",
        "tags": ["auth", "test"]
    }
    
    response = client.post(f"/v1/teams/{team1_name}/posts", json=post_data, headers=headers)
    assert response.status_code == 201
    
    data = response.json()
    assert data["post"]["author_name"] == "authenticated-user"
    assert data["post"]["team_name"] == team1_name


@pytest.mark.asyncio
async def test_authenticated_get_post(setup_auth_test_data):
    """Test getting a single post with valid authentication."""
    test_data = setup_auth_test_data
    team1_name = test_data["team1_name"]
    team1_key = test_data["team1_key"]
    post_id = test_data["post1_id"]
    
    headers = {"Authorization": f"Bearer {team1_key}"}
    response = client.get(f"/v1/teams/{team1_name}/posts/{post_id}", headers=headers)
    assert response.status_code == 200
    
    data = response.json()
    assert data["post"]["id"] == post_id
    assert data["post"]["team_name"] == team1_name


@pytest.mark.asyncio
async def test_authenticated_delete_post(setup_auth_test_data):
    """Test deleting a post with valid authentication."""
    test_data = setup_auth_test_data
    team1_name = test_data["team1_name"]
    team1_key = test_data["team1_key"]
    post_id = test_data["post1_id"]
    
    headers = {"Authorization": f"Bearer {team1_key}"}
    response = client.delete(f"/v1/teams/{team1_name}/posts/{post_id}", headers=headers)
    assert response.status_code == 204
    
    # Verify post is no longer accessible
    get_response = client.get(f"/v1/teams/{team1_name}/posts/{post_id}", headers=headers)
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_team_isolation(setup_auth_test_data):
    """Test that teams are completely isolated from each other."""
    test_data = setup_auth_test_data
    team1_name = test_data["team1_name"]
    team1_key = test_data["team1_key"]
    team2_name = test_data["team2_name"]
    team2_key = test_data["team2_key"]
    
    # Create post in team1
    team1_headers = {"Authorization": f"Bearer {team1_key}"}
    post_data = {"author_name": "team1-user", "content": "Team 1 exclusive content"}
    create_response = client.post(f"/v1/teams/{team1_name}/posts", json=post_data, headers=team1_headers)
    assert create_response.status_code == 201
    post_id = create_response.json()["post"]["id"]
    
    # Team2 should not see team1's posts
    team2_headers = {"Authorization": f"Bearer {team2_key}"}
    
    # List posts - should be empty for team2
    list_response = client.get(f"/v1/teams/{team2_name}/posts", headers=team2_headers)
    assert list_response.status_code == 200
    assert list_response.json()["total"] == 0
    
    # Try to access team1's post via team2 - should fail
    get_response = client.get(f"/v1/teams/{team2_name}/posts/{post_id}", headers=team2_headers)
    assert get_response.status_code == 404
    
    # Try to delete team1's post via team2 - should fail
    delete_response = client.delete(f"/v1/teams/{team2_name}/posts/{post_id}", headers=team2_headers)
    assert delete_response.status_code == 404


def test_health_endpoint_no_auth():
    """Test that health endpoint doesn't require authentication."""
    response = client.get("/v1/healthz")
    assert response.status_code == 200
    assert "status" in response.json()


@pytest.mark.asyncio
async def test_parent_post_validation_with_auth(setup_auth_test_data):
    """Test that parent post validation respects team boundaries."""
    test_data = setup_auth_test_data
    team1_name = test_data["team1_name"]
    team1_key = test_data["team1_key"]
    team2_key = test_data["team2_key"]
    team2_name = test_data["team2_name"]
    post1_id = test_data["post1_id"]
    
    # Try to create a reply in team2 using team1's post as parent
    team2_headers = {"Authorization": f"Bearer {team2_key}"}
    reply_data = {
        "author_name": "team2-user",
        "content": "Trying to reply to team1 post",
        "parent_post_id": post1_id
    }
    
    response = client.post(f"/v1/teams/{team2_name}/posts", json=reply_data, headers=team2_headers)
    assert response.status_code == 404
    assert f"Parent post '{post1_id}' not found" in response.json()["detail"]