# ABOUTME: Application configuration management reading from environment variables
# ABOUTME: Provides centralized settings for database, server, and build information

import os
from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env")

    port: int = 3000
    build_sha: str = "dev"
    debug: bool = False
    database_url: str = "sqlite+aiosqlite:///./app.db"


settings = Settings()
