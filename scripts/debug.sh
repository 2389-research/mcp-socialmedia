#!/bin/bash
# ABOUTME: Script to run the MCP server with debug logging enabled
# ABOUTME: Helps diagnose connection issues and URL handling

echo "Starting MCP server in debug mode..."
echo "This will show detailed logging for:"
echo "  - Server startup and configuration"
echo "  - Connection lifecycle events"
echo "  - API requests and responses"
echo "  - URL construction and handling"
echo ""

# Export debug log level
export LOG_LEVEL=DEBUG

# Run the server
npm start
