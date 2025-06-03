# ABOUTME: Main FastAPI application entry point for MCP Social Media API
# ABOUTME: Sets up the FastAPI app with middleware, routers, and configuration

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from .config import settings

app = FastAPI(
    title="MCP Social Media API",
    description="REST API for team-based social media posts",
    version="1.0.0",
    openapi_url="/v1/openapi.json",
    docs_url="/v1/docs",
    redoc_url="/v1/redoc",
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/v1/healthz")
async def health_check():
    return {"status": "ok", "buildSha": settings.build_sha}

if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=settings.debug,
    )
