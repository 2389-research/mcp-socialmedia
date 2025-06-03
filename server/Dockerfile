# ABOUTME: Multi-stage Dockerfile for MCP Social Media API
# ABOUTME: Creates optimized production image with dependencies and runtime layers

# Build stage - dependencies and build tools
FROM ghcr.io/astral-sh/uv:latest as uv

# Runtime stage
FROM python:3.13-slim as builder

# Copy uv from the official image
COPY --from=uv /usr/local/bin/uv /usr/local/bin/uv

# Set working directory
WORKDIR /app

# Install system dependencies for building
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files
COPY pyproject.toml uv.lock* ./

# Install dependencies using uv
RUN uv sync --frozen --no-dev

# Production stage - minimal runtime
FROM python:3.13-slim as runtime

# Copy uv from the official image
COPY --from=uv /usr/local/bin/uv /usr/local/bin/uv

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set working directory
WORKDIR /app

# Install only runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder stage
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

# Copy application code
COPY src/ ./src/
COPY alembic/ ./alembic/
COPY alembic.ini ./

# Create directories for data and logs
RUN mkdir -p /app/data /app/logs && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Environment variables
ENV PYTHONPATH=/app
ENV PORT=8000
ENV BUILD_SHA=docker
ENV DATABASE_URL=sqlite:///app/data/social_media.db
ENV LOG_LEVEL=INFO
ENV STRUCTURED_LOGGING=true

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/v1/healthz || exit 1

# Expose port
EXPOSE ${PORT}

# Run database migrations and start server
CMD ["sh", "-c", "uv run alembic upgrade head && uv run python -m uvicorn src.main:app --host 0.0.0.0 --port ${PORT}"]
