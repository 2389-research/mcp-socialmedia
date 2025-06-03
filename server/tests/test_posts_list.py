# ABOUTME: Integration tests for the posts list endpoint
# ABOUTME: Tests pagination, filtering, and error cases for GET /v1/teams/{team}/posts

import pytest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.main import app
from src.database import async_session_maker, init_db
from src.models import Team, Post


client = TestClient(app)


@pytest.fixture(scope="function")
async def setup_test_data():
    """Create test data for posts list tests."""
    await init_db()

    async with async_session_maker() as session:
        # Create a test team
        team = Team(name=f"test-team-{uuid.uuid4()}")
        session.add(team)
        await session.commit()

        # Create multiple test posts
        posts = []
        for i in range(15):  # Create more than default page size
            post = Post(
                team_id=team.id,
                author_name=f"author-{i}",
                content=f"Test post content {i}",
                tags=[f"tag-{i}", "test"] if i % 2 == 0 else ["test"],
            )
            posts.append(post)
            session.add(post)

        # Create a deleted post (should not appear in results)
        deleted_post = Post(
            team_id=team.id,
            author_name="deleted-author",
            content="This post should not appear",
            tags=["deleted"],
            deleted=True,
        )
        session.add(deleted_post)

        await session.commit()

        yield {"team_name": team.name, "team_id": team.id, "posts": posts}


@pytest.mark.asyncio
async def test_list_posts_default_pagination(setup_test_data):
    """Test listing posts with default pagination parameters."""
    test_data = setup_test_data
    team_name = test_data["team_name"]

    response = client.get(f"/v1/teams/{team_name}/posts")
    assert response.status_code == 200

    data = response.json()
    assert "posts" in data
    assert "total" in data
    assert "has_more" in data

    assert len(data["posts"]) == 10  # Default limit
    assert data["total"] == 15  # Total non-deleted posts
    assert data["has_more"] is True  # More posts available


@pytest.mark.asyncio
async def test_list_posts_custom_pagination(setup_test_data):
    """Test listing posts with custom limit and offset."""
    test_data = setup_test_data
    team_name = test_data["team_name"]

    response = client.get(f"/v1/teams/{team_name}/posts?limit=5&offset=5")
    assert response.status_code == 200

    data = response.json()
    assert len(data["posts"]) == 5
    assert data["total"] == 15
    assert data["has_more"] is True


@pytest.mark.asyncio
async def test_list_posts_last_page(setup_test_data):
    """Test listing posts on the last page."""
    test_data = setup_test_data
    team_name = test_data["team_name"]

    response = client.get(f"/v1/teams/{team_name}/posts?limit=10&offset=10")
    assert response.status_code == 200

    data = response.json()
    assert len(data["posts"]) == 5  # Remaining posts
    assert data["total"] == 15
    assert data["has_more"] is False  # No more posts


@pytest.mark.asyncio
async def test_list_posts_limit_validation(setup_test_data):
    """Test that invalid limit values are rejected."""
    test_data = setup_test_data
    team_name = test_data["team_name"]

    # Test limit too high
    response = client.get(f"/v1/teams/{team_name}/posts?limit=101")
    assert response.status_code == 422

    # Test limit too low
    response = client.get(f"/v1/teams/{team_name}/posts?limit=0")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_posts_offset_validation(setup_test_data):
    """Test that invalid offset values are rejected."""
    test_data = setup_test_data
    team_name = test_data["team_name"]

    # Test negative offset
    response = client.get(f"/v1/teams/{team_name}/posts?offset=-1")
    assert response.status_code == 422


def test_list_posts_team_not_found():
    """Test that 404 is returned for non-existent team."""
    response = client.get("/v1/teams/non-existent-team/posts")
    assert response.status_code == 404
    assert "Team 'non-existent-team' not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_list_posts_excludes_deleted(setup_test_data):
    """Test that deleted posts are not included in results."""
    test_data = setup_test_data
    team_name = test_data["team_name"]

    response = client.get(f"/v1/teams/{team_name}/posts?limit=100")
    assert response.status_code == 200

    data = response.json()
    # Should have 15 posts, not 16 (excluding the deleted one)
    assert data["total"] == 15
    assert len(data["posts"]) == 15

    # Verify no deleted posts in response
    for post in data["posts"]:
        assert post["deleted"] is False
