# ABOUTME: SQLAlchemy models for the MCP Social Media API database schema
# ABOUTME: Defines Team, Post, and ApiKey models with relationships and constraints

from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
import uuid


class Base(DeclarativeBase):
    pass


def generate_id() -> str:
    """Generate a unique ID for database records."""
    return str(uuid.uuid4())


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)

    # Relationships
    posts: Mapped[List["Post"]] = relationship("Post", back_populates="team")
    api_keys: Mapped[List["ApiKey"]] = relationship("ApiKey", back_populates="team")


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    team_id: Mapped[str] = mapped_column(String(36), ForeignKey("teams.id"), nullable=False)
    author_name: Mapped[str] = mapped_column(String(128), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[List[str]] = mapped_column(JSON, default=list)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    parent_post_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    deleted: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="posts")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    key: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    team_id: Mapped[str] = mapped_column(String(36), ForeignKey("teams.id"), nullable=False)

    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="api_keys")
