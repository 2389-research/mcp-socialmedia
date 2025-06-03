# ABOUTME: Database connection and model tests
# ABOUTME: Verifies that SQLAlchemy models and database operations work correctly

import pytest
import asyncio
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from src.database import engine, async_session_maker, init_db
from src.models import Team, Post, ApiKey


@pytest.fixture(scope="function")
async def db_session():
    """Create a test database session."""
    await init_db()
    async with async_session_maker() as session:
        yield session
        await session.rollback()


@pytest.mark.asyncio
async def test_database_connection():
    """Test that we can connect to the database."""
    await init_db()
    async with async_session_maker() as session:
        assert isinstance(session, AsyncSession)


@pytest.mark.asyncio
async def test_create_team(db_session):
    """Test creating a team record."""
    team = Team(name=f"test-team-{uuid.uuid4()}")
    db_session.add(team)
    await db_session.commit()

    assert team.id is not None
    assert team.name.startswith("test-team-")


@pytest.mark.asyncio
async def test_create_post(db_session):
    """Test creating a post record."""
    # First create a team
    team = Team(name=f"test-team-{uuid.uuid4()}")
    db_session.add(team)
    await db_session.commit()

    # Then create a post
    post = Post(
        team_id=team.id, author_name="alice", content="Hello world!", tags=["greeting", "test"]
    )
    db_session.add(post)
    await db_session.commit()

    assert post.id is not None
    assert post.team_id == team.id
    assert post.author_name == "alice"
    assert post.content == "Hello world!"
    assert post.tags == ["greeting", "test"]
    assert post.deleted is False


@pytest.mark.asyncio
async def test_create_api_key(db_session):
    """Test creating an API key record."""
    # First create a team
    team = Team(name=f"test-team-{uuid.uuid4()}")
    db_session.add(team)
    await db_session.commit()

    # Then create an API key
    api_key = ApiKey(key=f"test-key-{uuid.uuid4()}", team_id=team.id)
    db_session.add(api_key)
    await db_session.commit()

    assert api_key.id is not None
    assert api_key.key.startswith("test-key-")
    assert api_key.team_id == team.id
