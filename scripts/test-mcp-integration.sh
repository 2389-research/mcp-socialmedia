#!/bin/bash

# ABOUTME: Comprehensive MCP integration test runner
# ABOUTME: Starts server, runs all tests, provides detailed reporting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
HTTP_PORT=3001
TEST_TIMEOUT=300 # 5 minutes
SERVER_STARTUP_WAIT=5

echo -e "${BLUE}🚀 MCP Integration Test Suite${NC}"
echo "=================================="

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"
    if [ ! -z "$SERVER_PID" ]; then
        echo "Stopping MCP server (PID: $SERVER_PID)"
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    fi

    # Clean up any remaining processes
    pkill -f "MCP_TRANSPORT=http" 2>/dev/null || true

    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

# Set up cleanup on script exit
trap cleanup EXIT INT TERM

# Check if port is available
if lsof -Pi :$HTTP_PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${RED}❌ Port $HTTP_PORT is already in use${NC}"
    echo "Please stop any services using this port and try again"
    echo "Or use a different port: HTTP_PORT=3002 $0"
    exit 1
fi

echo -e "${BLUE}📦 Building project...${NC}"
npm run build

echo -e "${BLUE}🔧 Starting MCP server in HTTP mode...${NC}"
# Start the server in background
MCP_TRANSPORT=http MCP_HTTP_PORT=$HTTP_PORT MCP_HTTP_HOST=localhost npm start &
SERVER_PID=$!

echo "Server PID: $SERVER_PID"
echo "Waiting ${SERVER_STARTUP_WAIT} seconds for server startup..."
sleep $SERVER_STARTUP_WAIT

# Check if server is running
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${RED}❌ Server failed to start${NC}"
    exit 1
fi

# Test server connectivity
echo -e "${BLUE}🔍 Testing server connectivity...${NC}"
for i in {1..10}; do
    # Try a simple POST to the MCP endpoint
    if curl -s -X POST "http://localhost:$HTTP_PORT/mcp" \
        -H "Content-Type: application/json" \
        -d '{}' >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Server is responding${NC}"
        break
    fi

    if [ $i -eq 10 ]; then
        echo -e "${RED}❌ Server is not responding after 10 attempts${NC}"
        exit 1
    fi

    echo "Attempt $i/10 - waiting for server..."
    sleep 1
done

echo -e "\n${BLUE}🧪 Running MCP Integration Tests${NC}"
echo "===================================="

# Run the main integration tests
echo -e "${YELLOW}📋 Running core MCP SSE tests...${NC}"
TEST_URL="http://localhost:$HTTP_PORT" TEST_SERVER_AUTO_START=true npx jest tests/integration/mcp-sse.test.ts --verbose --timeout=$((TEST_TIMEOUT * 1000))

# Run load tests
echo -e "\n${YELLOW}⚡ Running load and performance tests...${NC}"
TEST_URL="http://localhost:$HTTP_PORT" TEST_SERVER_AUTO_START=true npx jest tests/integration/mcp-load.test.ts --verbose --timeout=$((TEST_TIMEOUT * 1000))

# Run existing integration tests with HTTP mode
echo -e "\n${YELLOW}🔄 Running existing integration tests...${NC}"
npx jest tests/integration/ --testPathIgnorePatterns="mcp-sse|mcp-load" --verbose

echo -e "\n${BLUE}📊 Test Summary${NC}"
echo "==================="

# Collect some basic metrics
TOTAL_TOOLS=$(curl -s -X POST "http://localhost:$HTTP_PORT/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: summary-session" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' 2>/dev/null || echo "")

if [ ! -z "$TOTAL_TOOLS" ]; then
    TOOLS_COUNT=$(curl -s -X POST "http://localhost:$HTTP_PORT/mcp" \
      -H "Content-Type: application/json" \
      -H "Accept: application/json, text/event-stream" \
      -H "Mcp-Session-Id: summary-session" \
      -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' 2>/dev/null | grep -o '"name"' | wc -l || echo "0")

    RESOURCES_COUNT=$(curl -s -X POST "http://localhost:$HTTP_PORT/mcp" \
      -H "Content-Type: application/json" \
      -H "Accept: application/json, text/event-stream" \
      -H "Mcp-Session-Id: summary-session" \
      -d '{"jsonrpc":"2.0","id":3,"method":"resources/list"}' 2>/dev/null | grep -o '"uri"' | wc -l || echo "0")

    PROMPTS_COUNT=$(curl -s -X POST "http://localhost:$HTTP_PORT/mcp" \
      -H "Content-Type: application/json" \
      -H "Accept: application/json, text/event-stream" \
      -H "Mcp-Session-Id: summary-session" \
      -d '{"jsonrpc":"2.0","id":4,"method":"prompts/list"}' 2>/dev/null | grep -o '"name"' | wc -l || echo "0")

    echo "🔧 Tools available: $TOOLS_COUNT"
    echo "📁 Resources available: $RESOURCES_COUNT"
    echo "📝 Prompts available: $PROMPTS_COUNT"
fi

echo "🌐 Server mode: HTTP with SSE"
echo "🔌 Server port: $HTTP_PORT"
echo "⏱️  Test timeout: $TEST_TIMEOUT seconds"

echo -e "\n${GREEN}✅ All tests completed successfully!${NC}"
echo -e "${BLUE}🎉 MCP Integration Test Suite Complete${NC}"

# Generate a simple test report
cat > mcp-test-report.md << EOF
# MCP Integration Test Report

Generated: $(date)

## Test Configuration
- Server Mode: HTTP with SSE
- Server Port: $HTTP_PORT
- Test Timeout: $TEST_TIMEOUT seconds

## Features Tested
- ✅ MCP Protocol Initialization
- ✅ Tools API (including new sampling tool)
- ✅ Resources API (including new roots resource)
- ✅ Prompts API
- ✅ Session Management
- ✅ Error Handling and Recovery
- ✅ Load Testing and Performance
- ✅ Concurrent Session Handling

## Available Endpoints
- Tools: $TOOLS_COUNT
- Resources: $RESOURCES_COUNT
- Prompts: $PROMPTS_COUNT

## Test Results
All tests passed successfully. See console output above for detailed results.

## Notes
This test suite validates the complete MCP implementation including:
- Phase 4: Sampling with LLM forwarding and templates
- Phase 7: Roots workspace boundaries
- Request/Response Hooks middleware
- Enhanced validation, error handling, and timeouts
EOF

echo -e "\n${BLUE}📄 Test report saved to: mcp-test-report.md${NC}"
