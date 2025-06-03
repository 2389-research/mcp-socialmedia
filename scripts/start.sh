#!/bin/bash

# MCP Agent Social Media Server Startup Script
# This script provides a robust way to start the server with proper checks

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PROJECT_ROOT}/logs/startup.log"
PID_FILE="${PROJECT_ROOT}/tmp/server.pid"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE" 2>/dev/null || true
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    echo "[ERROR] $1" >> "$LOG_FILE" 2>/dev/null || true
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    echo "[WARN] $1" >> "$LOG_FILE" 2>/dev/null || true
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "[SUCCESS] $1" >> "$LOG_FILE" 2>/dev/null || true
}

# Help function
show_help() {
    cat << EOF
MCP Agent Social Media Server Startup Script

Usage: $0 [OPTIONS]

Options:
    -h, --help          Show this help message
    -d, --dev           Start in development mode
    -p, --prod          Start in production mode
    -c, --check         Check configuration and dependencies
    -s, --stop          Stop running server
    -r, --restart       Restart server
    -t, --test          Run tests before starting
    --no-build          Skip build step
    --no-logs           Don't tail logs after starting
    --background        Start in background mode

Examples:
    $0                  # Start server with current environment
    $0 --dev            # Start in development mode
    $0 --prod           # Start in production mode
    $0 --check          # Check configuration only
    $0 --restart        # Restart server

Environment Variables:
    TEAM_NAME           Team namespace (required)
    SOCIAL_API_BASE_URL External API base URL (required)
    SOCIAL_API_KEY      API authentication key (required)
    LOG_LEVEL           Logging level (optional)
    NODE_ENV            Node environment (optional)

EOF
}

# Cleanup function
cleanup() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            log "Cleaning up process $pid"
            kill "$pid" 2>/dev/null || true
            sleep 2
            kill -9 "$pid" 2>/dev/null || true
        fi
        rm -f "$PID_FILE"
    fi
}

# Trap cleanup on script exit
trap cleanup EXIT INT TERM

# Check if server is running
is_running() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        kill -0 "$pid" 2>/dev/null
    else
        false
    fi
}

# Stop server
stop_server() {
    if is_running; then
        local pid=$(cat "$PID_FILE")
        log "Stopping server (PID: $pid)"
        kill "$pid"

        # Wait for graceful shutdown
        local count=0
        while kill -0 "$pid" 2>/dev/null && [[ $count -lt 30 ]]; do
            sleep 1
            count=$((count + 1))
        done

        if kill -0 "$pid" 2>/dev/null; then
            warn "Forcing server shutdown"
            kill -9 "$pid"
        fi

        rm -f "$PID_FILE"
        success "Server stopped"
    else
        warn "Server is not running"
    fi
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check Node.js version
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
        return 1
    fi

    local node_version=$(node --version | cut -d'v' -f2)
    local min_version="18.0.0"

    if ! printf '%s\n%s\n' "$min_version" "$node_version" | sort -V -C; then
        error "Node.js version $node_version is too old. Minimum required: $min_version"
        return 1
    fi

    log "Node.js version: $node_version ✓"

    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
        return 1
    fi

    log "npm version: $(npm --version) ✓"

    # Check if we're in the right directory
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        error "package.json not found. Are you in the correct directory?"
        return 1
    fi

    log "Project structure ✓"
    return 0
}

# Check configuration
check_configuration() {
    log "Checking configuration..."

    local missing_vars=()

    # Check required environment variables
    [[ -z "$TEAM_NAME" ]] && missing_vars+=("TEAM_NAME")
    [[ -z "$SOCIAL_API_BASE_URL" ]] && missing_vars+=("SOCIAL_API_BASE_URL")
    [[ -z "$SOCIAL_API_KEY" ]] && missing_vars+=("SOCIAL_API_KEY")

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        error "Missing required environment variables: ${missing_vars[*]}"
        error "Create a .env file or set these variables in your environment"
        return 1
    fi

    # Validate URL format
    if [[ ! "$SOCIAL_API_BASE_URL" =~ ^https?:// ]]; then
        error "SOCIAL_API_BASE_URL must start with http:// or https://"
        return 1
    fi

    log "Required configuration ✓"

    # Check optional variables
    log "Optional configuration:"
    log "  LOG_LEVEL: ${LOG_LEVEL:-INFO}"
    log "  NODE_ENV: ${NODE_ENV:-development}"
    log "  PORT: ${PORT:-3000}"

    return 0
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."

    if [[ ! -d "$PROJECT_ROOT/node_modules" ]] || [[ "$PROJECT_ROOT/package.json" -nt "$PROJECT_ROOT/node_modules/.package-lock.json" ]]; then
        log "Running npm install..."
        cd "$PROJECT_ROOT"
        npm install || {
            error "Failed to install dependencies"
            return 1
        }
        success "Dependencies installed"
    else
        log "Dependencies up to date ✓"
    fi

    return 0
}

# Build project
build_project() {
    if [[ "$SKIP_BUILD" != "true" ]]; then
        log "Building project..."
        cd "$PROJECT_ROOT"

        if [[ ! -d "build" ]] || [[ "src" -nt "build" ]]; then
            npm run build || {
                error "Build failed"
                return 1
            }
            success "Build completed"
        else
            log "Build up to date ✓"
        fi
    else
        log "Skipping build (--no-build specified)"
    fi

    return 0
}

# Run tests
run_tests() {
    if [[ "$RUN_TESTS" == "true" ]]; then
        log "Running tests..."
        cd "$PROJECT_ROOT"

        npm test || {
            error "Tests failed"
            return 1
        }

        success "All tests passed"
    fi

    return 0
}

# Start server
start_server() {
    if is_running; then
        warn "Server is already running (PID: $(cat "$PID_FILE"))"
        return 0
    fi

    log "Starting MCP Agent Social Media Server..."

    # Create necessary directories
    mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$PID_FILE")"

    cd "$PROJECT_ROOT"

    if [[ "$BACKGROUND" == "true" ]]; then
        # Start in background
        nohup node build/index.js > "$LOG_FILE" 2>&1 &
        echo $! > "$PID_FILE"

        # Wait a moment and check if it started successfully
        sleep 2
        if is_running; then
            success "Server started in background (PID: $(cat "$PID_FILE"))"
            log "Log file: $LOG_FILE"
        else
            error "Failed to start server"
            return 1
        fi
    else
        # Start in foreground
        log "Server starting in foreground mode..."
        log "Press Ctrl+C to stop"

        # Start and capture PID
        node build/index.js &
        echo $! > "$PID_FILE"

        if [[ "$NO_LOGS" != "true" ]]; then
            # Wait for server to start then tail logs
            sleep 2
            if is_running; then
                success "Server started (PID: $(cat "$PID_FILE"))"
                log "Tailing logs (Ctrl+C to stop)..."
                tail -f "$LOG_FILE" 2>/dev/null || wait
            else
                error "Failed to start server"
                return 1
            fi
        else
            wait
        fi
    fi

    return 0
}

# Parse command line arguments
DEVELOPMENT_MODE=false
PRODUCTION_MODE=false
CHECK_ONLY=false
STOP_SERVER=false
RESTART_SERVER=false
RUN_TESTS=false
SKIP_BUILD=false
NO_LOGS=false
BACKGROUND=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -d|--dev)
            DEVELOPMENT_MODE=true
            export NODE_ENV=development
            export LOG_LEVEL=DEBUG
            shift
            ;;
        -p|--prod)
            PRODUCTION_MODE=true
            export NODE_ENV=production
            export LOG_LEVEL=WARN
            shift
            ;;
        -c|--check)
            CHECK_ONLY=true
            shift
            ;;
        -s|--stop)
            STOP_SERVER=true
            shift
            ;;
        -r|--restart)
            RESTART_SERVER=true
            shift
            ;;
        -t|--test)
            RUN_TESTS=true
            shift
            ;;
        --no-build)
            SKIP_BUILD=true
            shift
            ;;
        --no-logs)
            NO_LOGS=true
            shift
            ;;
        --background)
            BACKGROUND=true
            shift
            ;;
        *)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Load .env file if it exists
if [[ -f "$PROJECT_ROOT/.env" ]]; then
    log "Loading environment from .env"
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
fi

# Main execution
main() {
    log "MCP Agent Social Media Server Startup Script"
    log "Project root: $PROJECT_ROOT"

    # Handle stop/restart commands
    if [[ "$STOP_SERVER" == "true" ]]; then
        stop_server
        exit $?
    fi

    if [[ "$RESTART_SERVER" == "true" ]]; then
        stop_server
        sleep 2
    fi

    # Check prerequisites
    if ! check_prerequisites; then
        exit 1
    fi

    # Check configuration
    if ! check_configuration; then
        exit 1
    fi

    if [[ "$CHECK_ONLY" == "true" ]]; then
        success "Configuration check passed"
        exit 0
    fi

    # Install dependencies
    if ! install_dependencies; then
        exit 1
    fi

    # Build project
    if ! build_project; then
        exit 1
    fi

    # Run tests if requested
    if ! run_tests; then
        exit 1
    fi

    # Start server
    if ! start_server; then
        exit 1
    fi
}

# Run main function
main "$@"
