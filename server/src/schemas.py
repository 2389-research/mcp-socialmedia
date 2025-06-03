# ABOUTME: Pydantic schemas for request and response models in the API
# ABOUTME: Defines data validation and serialization models for all endpoints

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class PostBase(BaseModel):
    """Base post schema with common fields."""

    author_name: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Name of the post author",
        json_schema_extra={"example": "alice"},
    )
    content: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="Post content text",
        json_schema_extra={"example": "Hello world! This is my first post."},
    )
    tags: List[str] = Field(
        default_factory=list,
        max_length=20,
        description="List of tags associated with the post",
        json_schema_extra={"example": ["greeting", "first-post"]},
    )
    parent_post_id: Optional[str] = Field(
        None,
        description="ID of parent post if this is a reply",
        json_schema_extra={"example": "550e8400-e29b-41d4-a716-446655440000"},
    )


class PostCreate(PostBase):
    """Schema for creating a new post or reply."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "author_name": "alice",
                "content": "Hello world! This is my first post.",
                "tags": ["greeting", "first-post"],
                "parent_post_id": None,
            }
        }
    )


class Post(PostBase):
    """Schema for returning post data."""

    id: str = Field(..., description="Unique post identifier")
    team_name: str = Field(..., description="Name of the team this post belongs to")
    timestamp: datetime = Field(..., description="When the post was created")
    deleted: bool = Field(False, description="Whether the post has been soft-deleted")

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "author_name": "alice",
                "content": "Hello world! This is my first post.",
                "tags": ["greeting", "first-post"],
                "parent_post_id": None,
                "team_name": "my-team",
                "timestamp": "2023-01-01T12:00:00Z",
                "deleted": False,
            }
        },
    )


class PostsResponse(BaseModel):
    """Schema for paginated posts response."""

    posts: List[Post] = Field(..., description="List of posts for the current page")
    total: int = Field(..., description="Total number of posts in the team")
    has_more: bool = Field(..., description="Whether there are more posts beyond this page")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "posts": [
                    {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "author_name": "alice",
                        "content": "Hello world! This is my first post.",
                        "tags": ["greeting", "first-post"],
                        "parent_post_id": None,
                        "team_name": "my-team",
                        "timestamp": "2023-01-01T12:00:00Z",
                        "deleted": False,
                    }
                ],
                "total": 1,
                "has_more": False,
            }
        }
    )


class PostResponse(BaseModel):
    """Schema for single post response."""

    post: Post = Field(..., description="The requested post")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "post": {
                    "id": "550e8400-e29b-41d4-a716-446655440000",
                    "author_name": "alice",
                    "content": "Hello world! This is my first post.",
                    "tags": ["greeting", "first-post"],
                    "parent_post_id": None,
                    "team_name": "my-team",
                    "timestamp": "2023-01-01T12:00:00Z",
                    "deleted": False,
                }
            }
        }
    )


class TeamBase(BaseModel):
    """Base team schema."""

    name: str = Field(..., min_length=1, max_length=128)


class Team(TeamBase):
    """Schema for returning team data."""

    id: str

    model_config = ConfigDict(from_attributes=True)


# Error Response Schemas for OpenAPI Documentation
class ErrorDetail(BaseModel):
    """Error detail within error envelope."""

    field: str = Field(..., description="Field path that caused the error")
    message: str = Field(..., description="Human-readable error message")
    type: str = Field(..., description="Error type/code")


class ErrorEnvelope(BaseModel):
    """Standard error response envelope."""

    error: str = Field(..., description="Human-readable error message")
    code: str = Field(..., description="Machine-readable error code")
    details: Dict[str, Any] = Field(
        default_factory=dict, description="Additional error details and context"
    )


class ErrorResponse(BaseModel):
    """Standard API error response."""

    detail: ErrorEnvelope = Field(..., description="Error details")


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = Field(..., description="Service status", example="ok")
    buildSha: str = Field(..., description="Build SHA or version", example="abc123")
