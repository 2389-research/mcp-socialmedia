# ABOUTME: Posts API router with CRUD operations for team posts
# ABOUTME: Implements GET, POST, DELETE endpoints with pagination, validation, and authentication

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request, Path
from pydantic import Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from ..database import get_db
from ..models import Post, Team
from ..schemas import PostsResponse, Post as PostSchema, PostCreate, PostResponse, ErrorResponse
from ..middleware.auth import require_team_access, AuthenticatedRequest
from ..middleware.rate_limit import limiter, rate_limit_posts_read, rate_limit_posts_write
from ..logging_config import get_logger, mask_api_key

logger = get_logger(__name__)

router = APIRouter()


@router.get(
    "/teams/{team}/posts",
    response_model=PostsResponse,
    summary="List team posts",
    description="Retrieve a paginated list of posts for a specific team",
    responses={
        200: {"description": "Successfully retrieved posts"},
        401: {"model": ErrorResponse, "description": "Invalid or missing API key"},
        403: {"model": ErrorResponse, "description": "API key does not have access to this team"},
        422: {"model": ErrorResponse, "description": "Invalid query parameters"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
    },
)
@limiter.limit("100/minute")  # Higher limit for read operations
async def list_posts(
    team: Annotated[str, Path(description="Team name", example="my-team")],
    request: Request = None,
    limit: Annotated[int, Query(ge=1, le=100, description="Number of posts to return")] = 10,
    offset: Annotated[int, Query(ge=0, description="Number of posts to skip for pagination")] = 0,
    db: AsyncSession = Depends(get_db),
):
    """
    List posts for a team with pagination.

    Returns a paginated list of posts for the specified team, ordered by timestamp
    (newest first). Only returns posts that have not been deleted.

    Authentication required: Bearer token with access to the specified team.
    Rate limit: 100 requests per minute per API key.
    """
    # Verify authentication and team access
    auth_info = await require_team_access(request, team)

    # Count total posts (excluding deleted)
    count_query = select(func.count(Post.id)).where(
        and_(Post.team_id == auth_info.team_id, Post.deleted == False)
    )
    count_result = await db.execute(count_query)
    total = count_result.scalar()

    # Get posts with pagination
    posts_query = (
        select(Post)
        .where(and_(Post.team_id == auth_info.team_id, Post.deleted == False))
        .order_by(Post.timestamp.desc())
        .offset(offset)
        .limit(limit)
    )
    posts_result = await db.execute(posts_query)
    posts_data = posts_result.scalars().all()

    # Convert to response schema
    posts = []
    for post in posts_data:
        post_dict = {
            "id": post.id,
            "author_name": post.author_name,
            "content": post.content,
            "tags": post.tags or [],
            "timestamp": post.timestamp,
            "parent_post_id": post.parent_post_id,
            "deleted": post.deleted,
            "team_name": auth_info.team_name,
        }
        posts.append(PostSchema(**post_dict))

    # Determine if there are more posts
    has_more = (offset + limit) < total

    return PostsResponse(posts=posts, total=total, has_more=has_more)


@router.post(
    "/teams/{team}/posts",
    response_model=PostResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new post",
    description="Create a new post or reply within a team",
    responses={
        201: {"description": "Post created successfully"},
        401: {"model": ErrorResponse, "description": "Invalid or missing API key"},
        403: {"model": ErrorResponse, "description": "API key does not have access to this team"},
        404: {
            "model": ErrorResponse,
            "description": "Parent post not found (if parent_post_id provided)",
        },
        422: {"model": ErrorResponse, "description": "Invalid post data"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
    },
)
@limiter.limit("30/minute")  # Lower limit for write operations
async def create_post(
    team: Annotated[str, Path(description="Team name", example="my-team")],
    post_data: PostCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new post or reply for a team.

    Creates a new post within the specified team. If parent_post_id is provided,
    this creates a reply to an existing post. The parent post must exist and
    belong to the same team.

    Authentication required: Bearer token with access to the specified team.
    Rate limit: 30 requests per minute per API key.
    """
    # Verify authentication and team access
    auth_info = await require_team_access(request, team)

    # If parent_post_id is provided, verify it exists and belongs to same team
    if post_data.parent_post_id:
        parent_query = select(Post).where(
            and_(
                Post.id == post_data.parent_post_id,
                Post.team_id == auth_info.team_id,
                Post.deleted == False,
            )
        )
        parent_result = await db.execute(parent_query)
        parent_post = parent_result.scalar_one_or_none()

        if not parent_post:
            raise HTTPException(
                status_code=404,
                detail=f"Parent post '{post_data.parent_post_id}' not found in team '{team}'",
            )

    # Create the new post
    new_post = Post(
        team_id=auth_info.team_id,
        author_name=post_data.author_name,
        content=post_data.content,
        tags=post_data.tags,
        parent_post_id=post_data.parent_post_id,
    )

    db.add(new_post)
    await db.commit()
    await db.refresh(new_post)

    # Log post creation
    logger.info(
        "Post created successfully",
        extra={
            "event_type": "post_created",
            "post_id": new_post.id,
            "team_name": auth_info.team_name,
            "author_name": post_data.author_name,
            "is_reply": post_data.parent_post_id is not None,
            "parent_post_id": post_data.parent_post_id,
            "content_length": len(post_data.content),
            "tag_count": len(post_data.tags or []),
            "api_key_masked": mask_api_key(auth_info.api_key),
        },
    )

    # Convert to response schema
    post_dict = {
        "id": new_post.id,
        "author_name": new_post.author_name,
        "content": new_post.content,
        "tags": new_post.tags or [],
        "timestamp": new_post.timestamp,
        "parent_post_id": new_post.parent_post_id,
        "deleted": new_post.deleted,
        "team_name": auth_info.team_name,
    }

    return PostResponse(post=PostSchema(**post_dict))


@router.get(
    "/teams/{team}/posts/{post_id}",
    response_model=PostResponse,
    summary="Get a single post",
    description="Retrieve a specific post by its ID within a team",
    responses={
        200: {"description": "Successfully retrieved the post"},
        401: {"model": ErrorResponse, "description": "Invalid or missing API key"},
        403: {"model": ErrorResponse, "description": "API key does not have access to this team"},
        404: {"model": ErrorResponse, "description": "Post not found or has been deleted"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
    },
)
@limiter.limit("100/minute")  # Higher limit for read operations
async def get_post(
    team: Annotated[str, Path(description="Team name", example="my-team")],
    post_id: Annotated[
        str, Path(description="Post ID to retrieve", example="550e8400-e29b-41d4-a716-446655440000")
    ],
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Get a single post by ID within a team.

    Retrieves a specific post by its unique identifier. The post must belong
    to the specified team and must not be deleted.

    Authentication required: Bearer token with access to the specified team.
    Rate limit: 100 requests per minute per API key.
    """
    # Verify authentication and team access
    auth_info = await require_team_access(request, team)

    # Find the post
    post_query = select(Post).where(
        and_(Post.id == post_id, Post.team_id == auth_info.team_id, Post.deleted == False)
    )
    post_result = await db.execute(post_query)
    post = post_result.scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail=f"Post '{post_id}' not found in team '{team}'")

    # Convert to response schema
    post_dict = {
        "id": post.id,
        "author_name": post.author_name,
        "content": post.content,
        "tags": post.tags or [],
        "timestamp": post.timestamp,
        "parent_post_id": post.parent_post_id,
        "deleted": post.deleted,
        "team_name": auth_info.team_name,
    }

    return PostResponse(post=PostSchema(**post_dict))


@router.delete(
    "/teams/{team}/posts/{post_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a post",
    description="Soft delete a post by marking it as deleted",
    responses={
        204: {"description": "Post deleted successfully"},
        401: {"model": ErrorResponse, "description": "Invalid or missing API key"},
        403: {"model": ErrorResponse, "description": "API key does not have access to this team"},
        404: {"model": ErrorResponse, "description": "Post not found or already deleted"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
    },
)
@limiter.limit("20/minute")  # Strict limit for delete operations
async def delete_post(
    team: Annotated[str, Path(description="Team name", example="my-team")],
    post_id: Annotated[
        str, Path(description="Post ID to delete", example="550e8400-e29b-41d4-a716-446655440000")
    ],
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Soft delete a post by marking it as deleted.

    Performs a soft delete by setting the deleted flag to True. The post
    will no longer appear in listings or be retrievable, but the data
    is preserved in the database.

    Authentication required: Bearer token with access to the specified team.
    Rate limit: 20 requests per minute per API key.
    """
    # Verify authentication and team access
    auth_info = await require_team_access(request, team)

    # Find the post
    post_query = select(Post).where(
        and_(Post.id == post_id, Post.team_id == auth_info.team_id, Post.deleted == False)
    )
    post_result = await db.execute(post_query)
    post = post_result.scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail=f"Post '{post_id}' not found in team '{team}'")

    # Soft delete the post
    post.deleted = True
    await db.commit()

    # Log post deletion
    logger.info(
        "Post deleted successfully",
        extra={
            "event_type": "post_deleted",
            "post_id": post_id,
            "team_name": auth_info.team_name,
            "author_name": post.author_name,
            "api_key_masked": mask_api_key(auth_info.api_key),
        },
    )

    # Return 204 No Content (FastAPI handles this automatically)
