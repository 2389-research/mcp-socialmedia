# ABOUTME: Integration tests for the posts creation endpoint
# ABOUTME: Tests creation of posts and replies with validation and error cases

import pytest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.main import app
from src.database import async_session_maker, init_db
from src.models import Team, Post


client = TestClient(app)


@pytest.fixture(scope="function")
async def setup_test_team():
    """Create a test team for post creation tests."""
    await init_db()

    async with async_session_maker() as session:
        # Create a test team
        team = Team(name=f"test-team-{uuid.uuid4()}")
        session.add(team)
        await session.commit()

        yield {"team_name": team.name, "team_id": team.id}


@pytest.fixture(scope="function")
async def setup_test_team_with_post():
    """Create a test team with an existing post for reply tests."""
    await init_db()

    async with async_session_maker() as session:
        # Create a test team
        team = Team(name=f"test-team-{uuid.uuid4()}")
        session.add(team)
        await session.commit()

        # Create a parent post
        parent_post = Post(
            team_id=team.id,
            author_name="parent-author",
            content="This is a parent post",
            tags=["parent", "test"]
        )
        session.add(parent_post)
        await session.commit()

        yield {
            "team_name": team.name,
            "team_id": team.id,
            "parent_post_id": parent_post.id
        }


@pytest.mark.asyncio
async def test_create_post_success(setup_test_team):
    """Test successful post creation."""
    test_data = setup_test_team
    team_name = test_data["team_name"]

    post_data = {
        "author_name": "alice",
        "content": "Hello world! This is my first post.",
        "tags": ["greeting", "first-post"]
    }

    response = client.post(f"/v1/teams/{team_name}/posts", json=post_data)
    assert response.status_code == 201

    data = response.json()
    assert "post" in data

    post = data["post"]
    assert post["author_name"] == "alice"
    assert post["content"] == "Hello world! This is my first post."
    assert post["tags"] == ["greeting", "first-post"]
    assert post["team_name"] == team_name
    assert post["parent_post_id"] is None
    assert post["deleted"] is False
    assert post["id"] is not None
    assert post["timestamp"] is not None


@pytest.mark.asyncio
async def test_create_post_minimal_data(setup_test_team):
    """Test creating a post with minimal required data."""
    test_data = setup_test_team
    team_name = test_data["team_name"]

    post_data = {
        "author_name": "bob",
        "content": "Minimal post"
    }

    response = client.post(f"/v1/teams/{team_name}/posts", json=post_data)
    assert response.status_code == 201

    data = response.json()
    post = data["post"]
    assert post["author_name"] == "bob"
    assert post["content"] == "Minimal post"
    assert post["tags"] == []  # Should default to empty list
    assert post["parent_post_id"] is None


@pytest.mark.asyncio
async def test_create_reply_success(setup_test_team_with_post):
    """Test successful reply creation to existing post."""
    test_data = setup_test_team_with_post
    team_name = test_data["team_name"]
    parent_post_id = test_data["parent_post_id"]

    reply_data = {
        "author_name": "charlie",
        "content": "This is a reply to the parent post",
        "tags": ["reply"],
        "parent_post_id": parent_post_id
    }

    response = client.post(f"/v1/teams/{team_name}/posts", json=reply_data)
    assert response.status_code == 201

    data = response.json()
    post = data["post"]
    assert post["author_name"] == "charlie"
    assert post["content"] == "This is a reply to the parent post"
    assert post["parent_post_id"] == parent_post_id


@pytest.mark.asyncio
async def test_create_post_validation_errors(setup_test_team):
    """Test validation errors for invalid post data."""
    test_data = setup_test_team
    team_name = test_data["team_name"]

    # Test missing author_name
    response = client.post(f"/v1/teams/{team_name}/posts", json={
        "content": "Missing author"
    })
    assert response.status_code == 422

    # Test missing content
    response = client.post(f"/v1/teams/{team_name}/posts", json={
        "author_name": "alice"
    })
    assert response.status_code == 422

    # Test empty content
    response = client.post(f"/v1/teams/{team_name}/posts", json={
        "author_name": "alice",
        "content": ""
    })
    assert response.status_code == 422

    # Test empty author_name
    response = client.post(f"/v1/teams/{team_name}/posts", json={
        "author_name": "",
        "content": "Valid content"
    })
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_post_content_length_limits(setup_test_team):
    """Test content length validation."""
    test_data = setup_test_team
    team_name = test_data["team_name"]

    # Test content too long (over 10000 chars)
    long_content = "x" * 10001
    response = client.post(f"/v1/teams/{team_name}/posts", json={
        "author_name": "alice",
        "content": long_content
    })
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_post_tags_validation(setup_test_team):
    """Test tags validation."""
    test_data = setup_test_team
    team_name = test_data["team_name"]

    # Test too many tags (over 20)
    too_many_tags = [f"tag-{i}" for i in range(21)]
    response = client.post(f"/v1/teams/{team_name}/posts", json={
        "author_name": "alice",
        "content": "Valid content",
        "tags": too_many_tags
    })
    assert response.status_code == 422


def test_create_post_team_not_found():
    """Test creating post for non-existent team."""
    response = client.post("/v1/teams/non-existent-team/posts", json={
        "author_name": "alice",
        "content": "This should fail"
    })
    assert response.status_code == 404
    assert "Team 'non-existent-team' not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_reply_invalid_parent(setup_test_team):
    """Test creating reply with invalid parent post ID."""
    test_data = setup_test_team
    team_name = test_data["team_name"]

    response = client.post(f"/v1/teams/{team_name}/posts", json={
        "author_name": "alice",
        "content": "Reply to non-existent post",
        "parent_post_id": "non-existent-post-id"
    })
    assert response.status_code == 404
    assert "Parent post 'non-existent-post-id' not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_reply_parent_from_different_team(setup_test_team_with_post):
    """Test creating reply with parent post from different team."""
    # Create another team
    await init_db()
    async with async_session_maker() as session:
        other_team = Team(name=f"other-team-{uuid.uuid4()}")
        session.add(other_team)
        await session.commit()
        other_team_name = other_team.name

    test_data = setup_test_team_with_post
    parent_post_id = test_data["parent_post_id"]

    # Try to create a reply in the other team using the parent from first team
    response = client.post(f"/v1/teams/{other_team_name}/posts", json={
        "author_name": "alice",
        "content": "Cross-team reply attempt",
        "parent_post_id": parent_post_id
    })
    assert response.status_code == 404
    assert f"Parent post '{parent_post_id}' not found" in response.json()["detail"]
