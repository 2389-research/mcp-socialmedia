# ABOUTME: Posts API router with CRUD operations for team posts
# ABOUTME: Implements GET, POST, DELETE endpoints with pagination and validation

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from ..database import get_db
from ..models import Post, Team
from ..schemas import PostsResponse, Post as PostSchema, PostCreate, PostResponse

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


@router.post("/teams/{team}/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    team: str,
    post_data: PostCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new post or reply for a team.

    Args:
        team: Team name
        post_data: Post creation data
        db: Database session

    Returns:
        PostResponse with the created post
    """
    # First, find the team
    team_query = select(Team).where(Team.name == team)
    team_result = await db.execute(team_query)
    team_obj = team_result.scalar_one_or_none()

    if not team_obj:
        raise HTTPException(status_code=404, detail=f"Team '{team}' not found")

    # If parent_post_id is provided, verify it exists and belongs to same team
    if post_data.parent_post_id:
        parent_query = select(Post).where(
            and_(
                Post.id == post_data.parent_post_id,
                Post.team_id == team_obj.id,
                Post.deleted == False
            )
        )
        parent_result = await db.execute(parent_query)
        parent_post = parent_result.scalar_one_or_none()

        if not parent_post:
            raise HTTPException(
                status_code=404,
                detail=f"Parent post '{post_data.parent_post_id}' not found in team '{team}'"
            )

    # Create the new post
    new_post = Post(
        team_id=team_obj.id,
        author_name=post_data.author_name,
        content=post_data.content,
        tags=post_data.tags,
        parent_post_id=post_data.parent_post_id,
    )

    db.add(new_post)
    await db.commit()
    await db.refresh(new_post)

    # Convert to response schema
    post_dict = {
        "id": new_post.id,
        "author_name": new_post.author_name,
        "content": new_post.content,
        "tags": new_post.tags or [],
        "timestamp": new_post.timestamp,
        "parent_post_id": new_post.parent_post_id,
        "deleted": new_post.deleted,
        "team_name": team_obj.name,
    }

    return PostResponse(post=PostSchema(**post_dict))


@router.get("/teams/{team}/posts/{post_id}", response_model=PostResponse)
async def get_post(
    team: str,
    post_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Get a single post by ID within a team.
    
    Args:
        team: Team name
        post_id: Post ID to retrieve
        db: Database session
    
    Returns:
        PostResponse with the requested post
    """
    # First, find the team
    team_query = select(Team).where(Team.name == team)
    team_result = await db.execute(team_query)
    team_obj = team_result.scalar_one_or_none()
    
    if not team_obj:
        raise HTTPException(status_code=404, detail=f"Team '{team}' not found")
    
    # Find the post
    post_query = select(Post).where(
        and_(
            Post.id == post_id,
            Post.team_id == team_obj.id,
            Post.deleted == False
        )
    )
    post_result = await db.execute(post_query)
    post = post_result.scalar_one_or_none()
    
    if not post:
        raise HTTPException(
            status_code=404, 
            detail=f"Post '{post_id}' not found in team '{team}'"
        )
    
    # Convert to response schema
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
    
    return PostResponse(post=PostSchema(**post_dict))


@router.delete("/teams/{team}/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    team: str,
    post_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Soft delete a post by setting deleted=True.
    
    Args:
        team: Team name
        post_id: Post ID to delete
        db: Database session
    
    Returns:
        204 No Content on successful deletion
    """
    # First, find the team
    team_query = select(Team).where(Team.name == team)
    team_result = await db.execute(team_query)
    team_obj = team_result.scalar_one_or_none()
    
    if not team_obj:
        raise HTTPException(status_code=404, detail=f"Team '{team}' not found")
    
    # Find the post
    post_query = select(Post).where(
        and_(
            Post.id == post_id,
            Post.team_id == team_obj.id,
            Post.deleted == False
        )
    )
    post_result = await db.execute(post_query)
    post = post_result.scalar_one_or_none()
    
    if not post:
        raise HTTPException(
            status_code=404, 
            detail=f"Post '{post_id}' not found in team '{team}'"
        )
    
    # Soft delete the post
    post.deleted = True
    await db.commit()
    
    # Return 204 No Content (FastAPI handles this automatically)
