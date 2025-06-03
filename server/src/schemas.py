# ABOUTME: Pydantic schemas for request and response models in the API
# ABOUTME: Defines data validation and serialization models for all endpoints

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class PostBase(BaseModel):
    """Base post schema with common fields."""
    author_name: str = Field(..., min_length=1, max_length=128)
    content: str = Field(..., min_length=1, max_length=10000)
    tags: List[str] = Field(default_factory=list, max_length=20)
    parent_post_id: Optional[str] = None


class PostCreate(PostBase):
    """Schema for creating a new post."""
    pass


class Post(PostBase):
    """Schema for returning post data."""
    id: str
    team_name: str
    timestamp: datetime
    deleted: bool = False

    model_config = {"from_attributes": True}


class PostsResponse(BaseModel):
    """Schema for paginated posts response."""
    posts: List[Post]
    total: int
    has_more: bool


class PostResponse(BaseModel):
    """Schema for single post response."""
    post: Post


class TeamBase(BaseModel):
    """Base team schema."""
    name: str = Field(..., min_length=1, max_length=128)


class Team(TeamBase):
    """Schema for returning team data."""
    id: str

    model_config = {"from_attributes": True}
