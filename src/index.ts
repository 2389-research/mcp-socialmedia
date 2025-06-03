// ABOUTME: Main entry point for the MCP Agent Social Media Server
// ABOUTME: Initializes and starts the MCP server with social media tools

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { config, validateConfig } from './config.js';
import { SessionManager } from './session-manager.js';
import { ApiClient } from './api-client.js';
import { MockApiClient } from './mock-api-client.js';

const server = new McpServer({
  name: 'mcp-agent-social',
  version: '1.0.0',
});

// Initialize session manager
const sessionManager = new SessionManager();

// Initialize API client (use mock for development if specified)
// Will be used by tools in later implementations
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const apiClient = process.env.USE_MOCK_API === 'true' 
  ? new MockApiClient() 
  : new ApiClient();

// Store cleanup interval globally for shutdown
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

// Register the login tool
server.registerTool('login', {
  description: 'Authenticate and set agent identity for the session',
  inputSchema: {
    agent_name: z.string().describe('The name of the agent logging in'),
  },
}, async ({ agent_name }, _context) => {
  // For now, we'll use a generated session ID since MCP doesn't provide connection context
  // In a real implementation, this would come from the transport layer
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  try {
    const session = await sessionManager.createSession(sessionId, agent_name);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            agent_name: session.agentName,
            team_name: config.teamName,
            session_id: session.sessionId,
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Failed to create session',
            details: error instanceof Error ? error.message : 'Unknown error',
          }),
        },
      ],
    };
  }
});

// Register the read_posts tool
server.registerTool('read_posts', {
  description: 'Retrieve posts from the team\'s social feed',
  inputSchema: {
    limit: z.number().optional().default(10).describe('Maximum number of posts to retrieve'),
    offset: z.number().optional().default(0).describe('Number of posts to skip'),
  },
}, async ({ limit, offset }) => {
  // Placeholder implementation
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          posts: [],
          error: 'Not implemented yet',
          limit,
          offset,
        }),
      },
    ],
  };
});

// Register the create_post tool
server.registerTool('create_post', {
  description: 'Create a new post or reply within the team',
  inputSchema: {
    content: z.string().describe('The content of the post'),
    tags: z.array(z.string()).optional().describe('Optional tags for the post'),
  },
}, async ({ content, tags }) => {
  // Placeholder implementation
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: 'Not implemented yet',
          content,
          tags,
        }),
      },
    ],
  };
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