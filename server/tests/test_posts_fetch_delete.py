# ABOUTME: Integration tests for fetch single post and delete post endpoints
# ABOUTME: Tests GET /v1/teams/{team}/posts/{id} and DELETE /v1/teams/{team}/posts/{id}

import pytest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.main import app
from src.database import async_session_maker, init_db
from src.models import Team, Post, ApiKey


client = TestClient(app)


@pytest.fixture(scope="function")
async def setup_test_data():
    """Create test data with team and posts for fetch/delete tests."""
    await init_db()

    async with async_session_maker() as session:
        # Create a test team
        team = Team(name=f"test-team-{uuid.uuid4()}")
        session.add(team)
        await session.commit()

        # Create multiple test posts
        posts = []
        for i in range(3):
            post = Post(
                team_id=team.id,
                author_name=f"author-{i}",
                content=f"Test post content {i}",
                tags=[f"tag-{i}", "test"] if i % 2 == 0 else ["test"],
            )
            posts.append(post)
            session.add(post)

        # Create a deleted post (should not be accessible)
        deleted_post = Post(
            team_id=team.id,
            author_name="deleted-author",
            content="This post is deleted",
            tags=["deleted"],
            deleted=True,
        )
        session.add(deleted_post)

        await session.commit()

        # Create API key for the team
        api_key = ApiKey(key=f"test-key-{uuid.uuid4()}", team_id=team.id)
        session.add(api_key)
        await session.commit()

        yield {
            "team_name": team.name,
            "team_id": team.id,
            "posts": posts,
            "deleted_post": deleted_post,
            "api_key": api_key.key,
        }


@pytest.mark.asyncio
async def test_get_post_success(setup_test_data):
    """Test successful retrieval of a single post."""
    test_data = setup_test_data
    team_name = test_data["team_name"]
    api_key = test_data["api_key"]
    post = test_data["posts"][0]  # Get first post
    headers = {"Authorization": f"Bearer {api_key}"}

    response = client.get(f"/v1/teams/{team_name}/posts/{post.id}", headers=headers)
    assert response.status_code == 200

    data = response.json()
    assert "postId" in data
    assert "author" in data
    assert "content" in data
    assert "createdAt" in data

    assert data["postId"] == post.id
    assert data["author"] == post.author_name
    assert data["content"] == post.content
    assert data["tags"] == post.tags
    assert data["parentPostId"] is None
    assert data["createdAt"] is not None
    assert "_seconds" in data["createdAt"]


@pytest.mark.asyncio
async def test_get_post_with_parent(setup_test_data):
    """Test retrieving a post that has a parent (reply)."""
    test_data = setup_test_data
    team_name = test_data["team_name"]
    api_key = test_data["api_key"]
    parent_post = test_data["posts"][0]
    headers = {"Authorization": f"Bearer {api_key}"}

    # Create a reply post
    async with async_session_maker() as session:
        reply_post = Post(
            team_id=test_data["team_id"],
            author_name="reply-author",
            content="This is a reply",
            tags=["reply"],
            parent_post_id=parent_post.id,
        )
        session.add(reply_post)
        await session.commit()
        reply_id = reply_post.id

    response = client.get(f"/v1/teams/{team_name}/posts/{reply_id}", headers=headers)
    assert response.status_code == 200

    data = response.json()
    assert data["parentPostId"] == parent_post.id


def test_get_post_team_not_found():
    """Test getting post from non-existent team (auth happens first)."""
    # Note: This test doesn't use api_key since we're testing auth first
    response = client.get("/v1/teams/non-existent-team/posts/some-post-id")
    assert response.status_code == 401
    assert "Invalid or missing API key" in response.json()["detail"]["error"]


@pytest.mark.asyncio
async def test_get_post_not_found(setup_test_data):
    """Test getting non-existent post from existing team."""
    test_data = setup_test_data
    team_name = test_data["team_name"]
    api_key = test_data["api_key"]
    headers = {"Authorization": f"Bearer {api_key}"}

    response = client.get(f"/v1/teams/{team_name}/posts/non-existent-post-id", headers=headers)
    assert response.status_code == 404
    assert "Post 'non-existent-post-id' not found" in response.json()["detail"]["error"]


@pytest.mark.asyncio
async def test_get_deleted_post_not_accessible(setup_test_data):
    """Test that deleted posts are not accessible via GET."""
    test_data = setup_test_data
    team_name = test_data["team_name"]
    api_key = test_data["api_key"]
    deleted_post_id = test_data["deleted_post"].id
    headers = {"Authorization": f"Bearer {api_key}"}

    response = client.get(f"/v1/teams/{team_name}/posts/{deleted_post_id}", headers=headers)
    assert response.status_code == 404
    assert f"Post '{deleted_post_id}' not found" in response.json()["detail"]["error"]


@pytest.mark.asyncio
async def test_get_post_from_different_team(setup_test_data):
    """Test that posts from one team can't be accessed via another team."""
    test_data = setup_test_data
    post_id = test_data["posts"][0].id

    # Create another team with API key
    async with async_session_maker() as session:
        other_team = Team(name=f"other-team-{uuid.uuid4()}")
        session.add(other_team)
        await session.commit()
        other_team_name = other_team.name

        # Create API key for the other team
        other_api_key = ApiKey(key=f"test-key-{uuid.uuid4()}", team_id=other_team.id)
        session.add(other_api_key)
        await session.commit()
        other_headers = {"Authorization": f"Bearer {other_api_key.key}"}

    # Try to access post from first team via second team
    response = client.get(f"/v1/teams/{other_team_name}/posts/{post_id}", headers=other_headers)
    assert response.status_code == 404
    assert f"Post '{post_id}' not found" in response.json()["detail"]["error"]


@pytest.mark.asyncio
async def test_delete_post_success(setup_test_data):
    """Test successful soft deletion of a post."""
    test_data = setup_test_data
    team_name = test_data["team_name"]
    api_key = test_data["api_key"]
    post = test_data["posts"][0]  # Get first post
    post_id = post.id
    headers = {"Authorization": f"Bearer {api_key}"}

    # Delete the post
    response = client.delete(f"/v1/teams/{team_name}/posts/{post_id}", headers=headers)
    assert response.status_code == 204
    assert response.content == b""  # No content in 204 response

    # Verify post is no longer accessible via GET
    get_response = client.get(f"/v1/teams/{team_name}/posts/{post_id}", headers=headers)
    assert get_response.status_code == 404

    # Verify post is not in list results
    list_response = client.get(f"/v1/teams/{team_name}/posts", headers=headers)
    assert list_response.status_code == 200
    posts_data = list_response.json()
    post_ids = [p["postId"] for p in posts_data["posts"]]
    assert post_id not in post_ids


def test_delete_post_team_not_found():
    """Test deleting post from non-existent team."""
    # Note: This test doesn't use api_key since we're testing auth first
    response = client.delete("/v1/teams/non-existent-team/posts/some-post-id")
    assert response.status_code == 401
    assert "Invalid or missing API key" in response.json()["detail"]["error"]


@pytest.mark.asyncio
async def test_delete_post_not_found(setup_test_data):
    """Test deleting non-existent post from existing team."""
    test_data = setup_test_data
    team_name = test_data["team_name"]
    api_key = test_data["api_key"]
    headers = {"Authorization": f"Bearer {api_key}"}

    response = client.delete(f"/v1/teams/{team_name}/posts/non-existent-post-id", headers=headers)
    assert response.status_code == 404
    assert "Post 'non-existent-post-id' not found" in response.json()["detail"]["error"]


@pytest.mark.asyncio
async def test_delete_already_deleted_post(setup_test_data):
    """Test that already deleted posts return 404 when trying to delete again."""
    test_data = setup_test_data
    team_name = test_data["team_name"]
    api_key = test_data["api_key"]
    deleted_post_id = test_data["deleted_post"].id
    headers = {"Authorization": f"Bearer {api_key}"}

    response = client.delete(f"/v1/teams/{team_name}/posts/{deleted_post_id}", headers=headers)
    assert response.status_code == 404
    assert f"Post '{deleted_post_id}' not found" in response.json()["detail"]["error"]


@pytest.mark.asyncio
async def test_delete_post_from_different_team(setup_test_data):
    """Test that posts from one team can't be deleted via another team."""
    test_data = setup_test_data
    post_id = test_data["posts"][0].id

    # Create another team with API key
    async with async_session_maker() as session:
        other_team = Team(name=f"other-team-{uuid.uuid4()}")
        session.add(other_team)
        await session.commit()
        other_team_name = other_team.name

        # Create API key for the other team
        other_api_key = ApiKey(key=f"test-key-{uuid.uuid4()}", team_id=other_team.id)
        session.add(other_api_key)
        await session.commit()
        other_headers = {"Authorization": f"Bearer {other_api_key.key}"}

    # Try to delete post from first team via second team
    response = client.delete(f"/v1/teams/{other_team_name}/posts/{post_id}", headers=other_headers)
    assert response.status_code == 404
    assert f"Post '{post_id}' not found" in response.json()["detail"]["error"]

    # Verify original post is still accessible in its proper team
    original_team_name = test_data["team_name"]
    api_key = test_data["api_key"]
    headers = {"Authorization": f"Bearer {api_key}"}
    get_response = client.get(f"/v1/teams/{original_team_name}/posts/{post_id}", headers=headers)
    assert get_response.status_code == 200


@pytest.mark.asyncio
async def test_delete_post_workflow(setup_test_data):
    """Test complete workflow: create, get, delete, verify deletion."""
    test_data = setup_test_data
    team_name = test_data["team_name"]
    api_key = test_data["api_key"]
    headers = {"Authorization": f"Bearer {api_key}"}

    # Create a new post
    post_data = {
        "author": "workflow-tester",
        "content": "Post for delete workflow test",
        "tags": ["workflow", "test"],
    }
    create_response = client.post(f"/v1/teams/{team_name}/posts", json=post_data, headers=headers)
    assert create_response.status_code == 201
    created_post = create_response.json()
    post_id = created_post["postId"]

    # Get the post to verify it exists
    get_response = client.get(f"/v1/teams/{team_name}/posts/{post_id}", headers=headers)
    assert get_response.status_code == 200

    # Delete the post
    delete_response = client.delete(f"/v1/teams/{team_name}/posts/{post_id}", headers=headers)
    assert delete_response.status_code == 204

    # Verify post is no longer accessible
    final_get_response = client.get(f"/v1/teams/{team_name}/posts/{post_id}", headers=headers)
    assert final_get_response.status_code == 404
