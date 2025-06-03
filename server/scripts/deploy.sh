#!/bin/bash
# ABOUTME: Production deployment script for MCP Social Media API
# ABOUTME: Handles Docker image deployment with health checks and rollback capabilities

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
IMAGE_NAME="${IMAGE_NAME:-mcp-social-api}"
REGISTRY="${REGISTRY:-ghcr.io}"
VERSION="${VERSION:-latest}"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for service health
wait_for_health() {
    local max_attempts=30
    local attempt=1

    log_info "Waiting for service to become healthy..."

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s http://localhost:8000/v1/healthz > /dev/null 2>&1; then
            log_success "Service is healthy!"
            return 0
        fi

        log_info "Attempt $attempt/$max_attempts - Service not ready yet..."
        sleep 5
        ((attempt++))
    done

    log_error "Service failed to become healthy after $max_attempts attempts"
    return 1
}

# Function to run smoke tests
run_smoke_tests() {
    log_info "Running smoke tests..."

    # Test health endpoint
    if ! curl -f -s http://localhost:8000/v1/healthz | jq -r '.status' | grep -q "ok"; then
        log_error "Health check failed"
        return 1
    fi
    log_success "✓ Health check passed"

    # Test metrics endpoint
    if ! curl -f -s http://localhost:8000/metrics | grep -q "http_request_duration_seconds"; then
        log_error "Metrics endpoint failed"
        return 1
    fi
    log_success "✓ Metrics endpoint passed"

    # Test OpenAPI docs
    if ! curl -f -s http://localhost:8000/v1/docs > /dev/null; then
        log_error "OpenAPI docs failed"
        return 1
    fi
    log_success "✓ OpenAPI docs passed"

    log_success "All smoke tests passed!"
}

# Function to backup current deployment
backup_deployment() {
    if [ -f "$PROJECT_ROOT/docker-compose.override.yml" ]; then
        cp "$PROJECT_ROOT/docker-compose.override.yml" "$PROJECT_ROOT/docker-compose.override.yml.backup"
        log_info "Backed up existing deployment configuration"
    fi
}

# Function to restore from backup
restore_backup() {
    if [ -f "$PROJECT_ROOT/docker-compose.override.yml.backup" ]; then
        mv "$PROJECT_ROOT/docker-compose.override.yml.backup" "$PROJECT_ROOT/docker-compose.override.yml"
        log_warning "Restored from backup"
    fi
}

# Function to deploy
deploy() {
    local image_tag="${REGISTRY}/${IMAGE_NAME}:${VERSION}"

    log_info "Starting deployment of ${image_tag}"

    # Change to project directory
    cd "$PROJECT_ROOT"

    # Create necessary directories
    mkdir -p data logs

    # Create production override file
    cat > docker-compose.override.yml << EOF
# Production overrides
version: '3.8'
services:
  api:
    image: ${image_tag}
    environment:
      - BUILD_SHA=${VERSION}
      - LOG_LEVEL=INFO
      - STRUCTURED_LOGGING=true
      - DEBUG=false
    restart: always
EOF

    # Pull latest image
    log_info "Pulling latest image..."
    docker compose pull api

    # Stop existing containers
    log_info "Stopping existing containers..."
    docker compose down

    # Start new containers
    log_info "Starting new containers..."
    docker compose up -d

    # Wait for health check
    if ! wait_for_health; then
        log_error "Deployment failed - service unhealthy"
        return 1
    fi

    # Run smoke tests
    if ! run_smoke_tests; then
        log_error "Deployment failed - smoke tests failed"
        return 1
    fi

    # Clean up old images
    log_info "Cleaning up old images..."
    docker image prune -f

    log_success "Deployment completed successfully!"
}

# Function to rollback
rollback() {
    log_warning "Rolling back deployment..."

    cd "$PROJECT_ROOT"

    # Stop current deployment
    docker compose down

    # Restore backup configuration
    restore_backup

    # Start with previous configuration
    docker compose up -d

    if wait_for_health; then
        log_success "Rollback completed successfully!"
    else
        log_error "Rollback failed!"
        return 1
    fi
}

# Function to show logs
show_logs() {
    cd "$PROJECT_ROOT"
    docker compose logs -f api
}

# Function to show status
show_status() {
    cd "$PROJECT_ROOT"
    docker compose ps
    echo ""
    if curl -f -s http://localhost:8000/v1/healthz > /dev/null 2>&1; then
        log_success "Service is healthy"
    else
        log_error "Service is not healthy"
    fi
}

# Main function
main() {
    # Check dependencies
    if ! command_exists docker; then
        log_error "Docker is not installed"
        exit 1
    fi

    if ! command_exists docker-compose && ! docker compose version > /dev/null 2>&1; then
        log_error "Docker Compose is not available"
        exit 1
    fi

    if ! command_exists curl; then
        log_error "curl is not installed"
        exit 1
    fi

    if ! command_exists jq; then
        log_error "jq is not installed"
        exit 1
    fi

    # Parse command line arguments
    case "${1:-deploy}" in
        deploy)
            backup_deployment
            if ! deploy; then
                log_error "Deployment failed, initiating rollback..."
                rollback
                exit 1
            fi
            ;;
        rollback)
            rollback
            ;;
        logs)
            show_logs
            ;;
        status)
            show_status
            ;;
        *)
            echo "Usage: $0 {deploy|rollback|logs|status}"
            echo ""
            echo "Commands:"
            echo "  deploy   - Deploy the application (default)"
            echo "  rollback - Rollback to previous deployment"
            echo "  logs     - Show application logs"
            echo "  status   - Show deployment status"
            echo ""
            echo "Environment variables:"
            echo "  IMAGE_NAME - Docker image name (default: mcp-social-api)"
            echo "  REGISTRY   - Docker registry (default: ghcr.io)"
            echo "  VERSION    - Image version (default: latest)"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
