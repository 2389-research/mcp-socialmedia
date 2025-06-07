# ABOUTME: Database seeding script to create demo teams, posts, and API keys
# ABOUTME: Provides initial data for development and testing purposes

import asyncio
import secrets
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import async_session_maker, init_db
from src.models import Team, Post, ApiKey


async def create_demo_data():
    """Create demo teams, posts, and API keys for development."""
    await init_db()

    async with async_session_maker() as session:
        # Create demo team
        demo_team = Team(name="demo")
        session.add(demo_team)
        await session.commit()
        await session.refresh(demo_team)

        # Create API key for demo team
        demo_api_key = ApiKey(
            key="demo-key-12345",
            team_id=demo_team.id
        )
        session.add(demo_api_key)

        # Create some demo posts
        demo_posts = [
            Post(
                team_id=demo_team.id,
                author_name="alice",
                content="Welcome to the demo team! This is our first post.",
                tags=["welcome", "announcement"]
            ),
            Post(
                team_id=demo_team.id,
                author_name="bob",
                content="Thanks Alice! Excited to be here and collaborate.",
                tags=["reply", "thanks"]
            ),
            Post(
                team_id=demo_team.id,
                author_name="charlie",
                content="Here's an update on the project status. Everything looks good!",
                tags=["update", "project", "status"]
            )
        ]

        for post in demo_posts:
            session.add(post)

        await session.commit()

        # Create a reply to the first post
        await session.refresh(demo_posts[0])  # Get the ID
        reply_post = Post(
            team_id=demo_team.id,
            author_name="diana",
            content="Great to see everyone getting started!",
            tags=["reply"],
            parent_post_id=demo_posts[0].id
        )
        session.add(reply_post)
        await session.commit()

        print(f"✅ Created demo team: {demo_team.name}")
        print(f"✅ Created API key: {demo_api_key.key}")
        print(f"✅ Created {len(demo_posts) + 1} demo posts")


async def create_additional_test_team():
    """Create an additional team for testing purposes."""
    async with async_session_maker() as session:
        # Create test team
        test_team = Team(name="test-team")
        session.add(test_team)
        await session.commit()
        await session.refresh(test_team)

        # Create API key for test team
        test_api_key = ApiKey(
            key="test-key-67890",
            team_id=test_team.id
        )
        session.add(test_api_key)
        await session.commit()

        print(f"✅ Created test team: {test_team.name}")
        print(f"✅ Created API key: {test_api_key.key}")


async def generate_secure_api_key() -> str:
    """Generate a cryptographically secure API key."""
    return secrets.token_urlsafe(32)


async def main():
    """Run the seeding process."""
    print("🌱 Seeding database with demo data...")

    try:
        await create_demo_data()
        await create_additional_test_team()
        print("\n🎉 Database seeding completed successfully!")
        print("\nAPI Keys for testing:")
        print("Demo team: demo-key-12345")
        print("Test team: test-key-67890")

    except Exception as e:
        print(f"❌ Error during seeding: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
