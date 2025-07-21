#!/bin/bash

# MCP-Probe Testing Suite for mcp-agent-social
# Comprehensive testing script using mcp-probe

set -e

# Set test environment variables if not already set
export SOCIALMEDIA_API_BASE_URL=${SOCIALMEDIA_API_BASE_URL:-"https://api.example.com"}
export SOCIALMEDIA_API_KEY=${SOCIALMEDIA_API_KEY:-"test-key-local"}
export SOCIALMEDIA_TEAM_ID=${SOCIALMEDIA_TEAM_ID:-"local-test-team"}
export LOG_LEVEL=${LOG_LEVEL:-"error"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 MCP-Probe Testing Suite for mcp-agent-social${NC}"
echo "=================================================="

# Build the project first
echo -e "${YELLOW}📦 Building project...${NC}"
npm run build

# Create reports directory
mkdir -p reports/mcp-probe

echo -e "${BLUE}1. Protocol Compliance Validation${NC}"
mcp-probe validate \
  --stdio "node" \
  --args "dist/index.js" \
  --working-dir "$PWD" \
  --report "reports/mcp-probe/compliance-report.json" \
  --severity "warning"

echo -e "${GREEN}✅ Compliance validation complete${NC}"

echo -e "${BLUE}2. Running Interactive Tests${NC}"

# Test individual tools
echo -e "${YELLOW}Testing tools...${NC}"
mcp-probe test \
  --stdio "node" \
  --args "dist/index.js" \
  --working-dir "$PWD" \
  --test-type "tools" \
  --report "reports/mcp-probe/tools-report.json"

echo -e "${YELLOW}Testing resources...${NC}"
mcp-probe test \
  --stdio "node" \
  --args "dist/index.js" \
  --working-dir "$PWD" \
  --test-type "resources" \
  --report "reports/mcp-probe/resources-report.json"

echo -e "${YELLOW}Testing prompts...${NC}"
mcp-probe test \
  --stdio "node" \
  --args "dist/index.js" \
  --working-dir "$PWD" \
  --test-type "prompts" \
  --report "reports/mcp-probe/prompts-report.json"

echo -e "${BLUE}3. Performance Testing${NC}"
mcp-probe test \
  --stdio "node" \
  --args "dist/index.js" \
  --working-dir "$PWD" \
  --test-type "performance" \
  --report "reports/mcp-probe/performance-report.json"

echo -e "${BLUE}4. HTTP Transport Testing${NC}"
# Set HTTP environment variables for testing
export MCP_TRANSPORT="http"
export MCP_HTTP_PORT="3000"

# Start server in background for HTTP testing
npm run start:http &
HTTP_PID=$!

# Wait for server to start
sleep 3

# Test HTTP+SSE endpoint
echo -e "${YELLOW}Testing HTTP+SSE transport...${NC}"
mcp-probe validate \
  --http-sse "http://localhost:3000/mcp" \
  --report "reports/mcp-probe/http-sse-report.json" || true

# Kill background server
kill $HTTP_PID 2>/dev/null || true

echo -e "${GREEN}🎉 All mcp-probe tests completed!${NC}"
echo -e "${BLUE}📊 Reports saved in: reports/mcp-probe/${NC}"

# Generate summary
echo -e "${BLUE}📋 Test Summary:${NC}"
echo "- Compliance Report: reports/mcp-probe/compliance-report.json"
echo "- Tools Test Report: reports/mcp-probe/tools-report.json"
echo "- Resources Test Report: reports/mcp-probe/resources-report.json"
echo "- Prompts Test Report: reports/mcp-probe/prompts-report.json"
echo "- Performance Report: reports/mcp-probe/performance-report.json"
echo "- HTTP SSE Report: reports/mcp-probe/http-sse-report.json"

echo -e "${GREEN}✅ MCP-Probe testing suite completed successfully!${NC}"
