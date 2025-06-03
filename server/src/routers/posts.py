# ABOUTME: Posts API router with CRUD operations for team posts
# ABOUTME: Implements GET, POST, DELETE endpoints with pagination and validation

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from ..database import get_db
from ..models import Post, Team
from ..schemas import PostsResponse, Post as PostSchema

router = APIRouter()


@router.get("/teams/{team}/posts", response_model=PostsResponse)
async def list_posts(
    team: str,
    limit: Annotated[int, Query(ge=1, le=100)] = 10,
    offset: Annotated[int, Query(ge=0)] = 0,
    db: AsyncSession = Depends(get_db),
):
    """
    List posts for a team with pagination.

    Args:
        team: Team name
        limit: Number of posts to return (1-100, default 10)
        offset: Number of posts to skip (default 0)
        db: Database session

    Returns:
        PostsResponse with posts, total count, and has_more flag
    """
    # First, find the team
    team_query = select(Team).where(Team.name == team)
    team_result = await db.execute(team_query)
    team_obj = team_result.scalar_one_or_none()

    if not team_obj:
        raise HTTPException(status_code=404, detail=f"Team '{team}' not found")

    # Count total posts (excluding deleted)
    count_query = select(func.count(Post.id)).where(
        and_(Post.team_id == team_obj.id, Post.deleted == False)
    )
    count_result = await db.execute(count_query)
    total = count_result.scalar()

    # Get posts with pagination
    posts_query = (
        select(Post, Team)
        .join(Team, Post.team_id == Team.id)
        .where(and_(Post.team_id == team_obj.id, Post.deleted == False))
        .order_by(Post.timestamp.desc())
        .offset(offset)
        .limit(limit)
    )
    posts_result = await db.execute(posts_query)
    posts_data = posts_result.all()

    # Convert to response schema
    posts = []
    for post, team_obj in posts_data:
        post_dict = {
            "id": post.id,
            "author_name": post.author_name,
            "content": post.content,
            "tags": post.tags or [],
            "timestamp": post.timestamp,
            "parent_post_id": post.parent_post_id,
            "deleted": post.deleted,
            "team_name": team_obj.name,
        }
        posts.append(PostSchema(**post_dict))

    # Determine if there are more posts
    has_more = (offset + limit) < total

    return PostsResponse(
        posts=posts,
        total=total,
        has_more=has_more
    )
