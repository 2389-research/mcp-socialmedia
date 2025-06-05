# ABOUTME: Integration tests for the posts creation endpoint
# ABOUTME: Tests creation of posts and replies with validation and error cases

import pytest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.main import app
from src.database import async_session_maker, init_db
from src.models import Team, Post, ApiKey


client = TestClient(app)


@pytest.fixture(scope="function")
async def setup_test_team():
    """Create a test team with API key for post creation tests."""
    await init_db()

    async with async_session_maker() as session:
        # Create a test team
        team = Team(name=f"test-team-{uuid.uuid4()}")
        session.add(team)
        await session.commit()
        await session.refresh(team)

        # Create API key for the team
        api_key = ApiKey(key=f"test-key-{uuid.uuid4()}", team_id=team.id)
        session.add(api_key)
        await session.commit()

        yield {"team_name": team.name, "team_id": team.id, "api_key": api_key.key}


@pytest.fixture(scope="function")
async def setup_test_team_with_post():
    """Create a test team with API key and an existing post for reply tests."""
    await init_db()

    async with async_session_maker() as session:
        # Create a test team
        team = Team(name=f"test-team-{uuid.uuid4()}")
        session.add(team)
        await session.commit()
        await session.refresh(team)

        # Create API key for the team
        api_key = ApiKey(key=f"test-key-{uuid.uuid4()}", team_id=team.id)
        session.add(api_key)
        await session.commit()

        # Create a parent post
        parent_post = Post(
            team_id=team.id,
            author_name="parent-author",
            content="This is a parent post",
            tags=["parent", "test"],
        )
        session.add(parent_post)
        await session.commit()
        await session.refresh(parent_post)

        yield {
            "team_name": team.name,
            "team_id": team.id,
            "api_key": api_key.key,
            "parent_post_id": parent_post.id,
        }


@pytest.mark.asyncio
async def test_create_post_success(setup_test_team):
    """Test successful post creation."""
    test_data = setup_test_team
    team_name = test_data["team_name"]
    api_key = test_data["api_key"]

    post_data = {
        "author": "alice",
        "content": "Hello world! This is my first post.",
        "tags": ["greeting", "first-post"],
    }

    headers = {"Authorization": f"Bearer {api_key}"}
    response = client.post(f"/v1/teams/{team_name}/posts", json=post_data, headers=headers)
    assert response.status_code == 201

    data = response.json()
    assert "postId" in data
    assert "author" in data
    assert "content" in data
    assert "createdAt" in data

    assert data["author"] == "alice"
    assert data["content"] == "Hello world! This is my first post."
    assert data["tags"] == ["greeting", "first-post"]
    assert data["parentPostId"] is None
    assert data["postId"] is not None
    assert data["createdAt"] is not None
    assert "_seconds" in data["createdAt"]


@pytest.mark.asyncio
async def test_create_post_minimal_data(setup_test_team):
    """Test creating a post with minimal required data."""
    test_data = setup_test_team
    team_name = test_data["team_name"]
    api_key = test_data["api_key"]

    post_data = {"author": "bob", "content": "Minimal post"}

    headers = {"Authorization": f"Bearer {api_key}"}
    response = client.post(f"/v1/teams/{team_name}/posts", json=post_data, headers=headers)
    assert response.status_code == 201

    data = response.json()
    assert data["author"] == "bob"
    assert data["content"] == "Minimal post"
    assert data["tags"] == []  # Should default to empty list
    assert data["parentPostId"] is None


@pytest.mark.asyncio
async def test_create_reply_success(setup_test_team_with_post):
    """Test successful reply creation to existing post."""
    test_data = setup_test_team_with_post
    team_name = test_data["team_name"]
    api_key = test_data["api_key"]
    parent_post_id = test_data["parent_post_id"]

    reply_data = {
        "author": "charlie",
        "content": "This is a reply to the parent post",
        "tags": ["reply"],
        "parentPostId": parent_post_id,
    }

    headers = {"Authorization": f"Bearer {api_key}"}
    response = client.post(f"/v1/teams/{team_name}/posts", json=reply_data, headers=headers)
    assert response.status_code == 201

    data = response.json()
    assert data["author"] == "charlie"
    assert data["content"] == "This is a reply to the parent post"
    assert data["parentPostId"] == parent_post_id


@pytest.mark.asyncio
async def test_create_post_validation_errors(setup_test_team):
    """Test validation errors for invalid post data."""
    test_data = setup_test_team
    team_name = test_data["team_name"]
    api_key = test_data["api_key"]
    headers = {"Authorization": f"Bearer {api_key}"}

    # Test missing author
    response = client.post(
        f"/v1/teams/{team_name}/posts", json={"content": "Missing author"}, headers=headers
    )
    assert response.status_code == 422

    # Test missing content
    response = client.post(
        f"/v1/teams/{team_name}/posts", json={"author": "alice"}, headers=headers
    )
    assert response.status_code == 422

    # Test empty content
    response = client.post(
        f"/v1/teams/{team_name}/posts",
        json={"author": "alice", "content": ""},
        headers=headers,
    )
    assert response.status_code == 422

    # Test empty author
    response = client.post(
        f"/v1/teams/{team_name}/posts",
        json={"author": "", "content": "Valid content"},
        headers=headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_post_content_length_limits(setup_test_team):
    """Test content length validation."""
    test_data = setup_test_team
    team_name = test_data["team_name"]
    api_key = test_data["api_key"]
    headers = {"Authorization": f"Bearer {api_key}"}

    # Test content too long (over 10000 chars)
    long_content = "x" * 10001
    response = client.post(
        f"/v1/teams/{team_name}/posts",
        json={"author": "alice", "content": long_content},
        headers=headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_post_tags_validation(setup_test_team):
    """Test tags validation."""
    test_data = setup_test_team
    team_name = test_data["team_name"]
    api_key = test_data["api_key"]
    headers = {"Authorization": f"Bearer {api_key}"}

    # Test too many tags (over 20)
    too_many_tags = [f"tag-{i}" for i in range(21)]
    response = client.post(
        f"/v1/teams/{team_name}/posts",
        json={"author": "alice", "content": "Valid content", "tags": too_many_tags},
        headers=headers,
    )
    assert response.status_code == 422


def test_create_post_team_not_found():
    """Test creating post for non-existent team (should fail on auth first)."""
    response = client.post(
        "/v1/teams/non-existent-team/posts",
        json={"author": "alice", "content": "This should fail"},
    )
    assert response.status_code == 401
    assert "Invalid or missing API key" in response.json()["detail"]["error"]


@pytest.mark.asyncio
async def test_create_reply_invalid_parent(setup_test_team):
    """Test creating reply with invalid parent post ID."""
    test_data = setup_test_team
    team_name = test_data["team_name"]
    api_key = test_data["api_key"]
    headers = {"Authorization": f"Bearer {api_key}"}

    response = client.post(
        f"/v1/teams/{team_name}/posts",
        json={
            "author": "alice",
            "content": "Reply to non-existent post",
            "parentPostId": "non-existent-post-id",
        },
        headers=headers,
    )
    assert response.status_code == 404
    assert "Parent post 'non-existent-post-id' not found" in response.json()["detail"]["error"]


@pytest.mark.asyncio
async def test_create_reply_parent_from_different_team(setup_test_team_with_post):
    """Test creating reply with parent post from different team."""
    # Create another team with API key
    await init_db()
    async with async_session_maker() as session:
        other_team = Team(name=f"other-team-{uuid.uuid4()}")
        session.add(other_team)
        await session.commit()
        await session.refresh(other_team)

        other_api_key = ApiKey(key=f"other-test-key-{uuid.uuid4()}", team_id=other_team.id)
        session.add(other_api_key)
        await session.commit()

        other_team_name = other_team.name
        other_key = other_api_key.key

    test_data = setup_test_team_with_post
    parent_post_id = test_data["parent_post_id"]

    # Try to create a reply in the other team using the parent from first team
    headers = {"Authorization": f"Bearer {other_key}"}
    response = client.post(
        f"/v1/teams/{other_team_name}/posts",
        json={
            "author": "alice",
            "content": "Cross-team reply attempt",
            "parentPostId": parent_post_id,
        },
        headers=headers,
    )
    assert response.status_code == 404
    assert f"Parent post '{parent_post_id}' not found" in response.json()["detail"]["error"]
