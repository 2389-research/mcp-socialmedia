// ABOUTME: Main entry point for the MCP Agent Social Media Server
// ABOUTME: Initializes and starts the MCP server with social media tools

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { config, validateConfig } from './config.js';
import { SessionManager } from './session-manager.js';
import { ApiClient } from './api-client.js';
import { loginToolSchema, loginToolHandler } from './tools/login.js';
import { readPostsToolSchema, readPostsToolHandler } from './tools/read-posts.js';
import { createPostToolSchema, createPostToolHandler } from './tools/create-post.js';

const server = new McpServer({
  name: 'mcp-agent-social',
  version: '1.0.0',
});

// Initialize session manager
const sessionManager = new SessionManager();

// Initialize API client
const apiClient = new ApiClient();

// Store cleanup interval globally for shutdown
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

// Register the login tool
server.registerTool('login', loginToolSchema, async (args, _mcpContext) => {
  // Create context for the login tool - use a global session for this MCP server instance
  const toolContext = {
    sessionManager,
    getSessionId: () => 'global-session',
  };

  return loginToolHandler(args, toolContext);
});

// Register the read_posts tool
server.registerTool('read_posts', readPostsToolSchema, async (args, _mcpContext) => {
  // Create context for the read posts tool
  const toolContext = {
    apiClient,
  };

  return readPostsToolHandler(args, toolContext);
});

// Register the create_post tool
server.registerTool('create_post', createPostToolSchema, async (args, _mcpContext) => {
  // Create context for the create post tool - use same global session
  const toolContext = {
    sessionManager,
    apiClient,
    getSessionId: () => 'global-session',
  };

  return createPostToolHandler(args, toolContext);
});

async function main() {
  try {
    validateConfig();
    console.error(`Starting MCP server for team: ${config.teamName}`);
    console.error(`API endpoint: ${config.socialApiBaseUrl}`);

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Agent Social Server running...');

    // Set up graceful shutdown
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Set up periodic session cleanup (every 30 minutes)
    cleanupInterval = setInterval(() => {
      const removed = sessionManager.cleanupOldSessions(3600000); // 1 hour
      if (removed > 0) {
        console.error(`Cleaned up ${removed} old sessions`);
      }
    }, 1800000); // 30 minutes
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  console.error(`\nReceived ${signal}, shutting down gracefully...`);

  // Clear cleanup interval
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  // Clean up sessions
  const sessionCount = sessionManager.getSessionCount();
  if (sessionCount > 0) {
    console.error(`Cleaning up ${sessionCount} active sessions...`);
    sessionManager.clearAllSessions();
  }

  // Close server
  await server.close();
  process.exit(0);
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
