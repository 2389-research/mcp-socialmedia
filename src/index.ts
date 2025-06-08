// ABOUTME: Main entry point for the MCP Agent Social Media Server
// ABOUTME: Initializes and starts the MCP server with social media tools

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { z } from 'zod';
import { ApiClient } from './api-client.js';
import { config, validateConfig } from './config.js';
import { logger } from './logger.js';
import { metrics } from './metrics.js';
import { SessionManager } from './session-manager.js';
import {
  type createPostInputSchema,
  createPostToolHandler,
  createPostToolSchema,
} from './tools/create-post.js';
import { type loginInputSchema, loginToolHandler, loginToolSchema } from './tools/login.js';
import {
  type readPostsInputSchema,
  readPostsToolHandler,
  readPostsToolSchema,
} from './tools/read-posts.js';

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
let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

// Register the login tool
server.registerTool(
  'login',
  {
    description: loginToolSchema.description,
    inputSchema: loginToolSchema.inputSchema,
    annotations: loginToolSchema.annotations,
  },
  async (args, _mcpContext) => {
    // Create context for the login tool - use a global session for this MCP server instance
    const toolContext = {
      sessionManager,
      getSessionId: () => 'global-session',
    };

    return loginToolHandler(args as z.infer<typeof loginInputSchema>, toolContext);
  },
);

// Register the read_posts tool
server.registerTool(
  'read_posts',
  {
    description: readPostsToolSchema.description,
    inputSchema: readPostsToolSchema.inputSchema,
    annotations: readPostsToolSchema.annotations,
  },
  async (args, _mcpContext) => {
    // Create context for the read posts tool
    const toolContext = {
      apiClient,
    };

    return readPostsToolHandler(args as z.infer<typeof readPostsInputSchema>, toolContext);
  },
);

// Register the create_post tool
server.registerTool(
  'create_post',
  {
    description: createPostToolSchema.description,
    inputSchema: createPostToolSchema.inputSchema,
    annotations: createPostToolSchema.annotations,
  },
  async (args, _mcpContext) => {
    // Create context for the create post tool - use same global session
    const toolContext = {
      sessionManager,
      apiClient,
      getSessionId: () => 'global-session',
    };

    return createPostToolHandler(args as z.infer<typeof createPostInputSchema>, toolContext);
  },
);

async function main() {
  try {
    // Log startup information
    logger.info('MCP Server starting', {
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
      logLevel: process.env.LOG_LEVEL || 'INFO',
    });

    validateConfig();

    // Log configuration (without sensitive data)
    logger.info(`Starting MCP server for team: ${config.teamName}`);
    logger.debug('Configuration loaded', {
      baseUrl: config.socialApiBaseUrl,
      teamName: config.teamName,
      timeout: config.apiTimeout,
      logLevel: config.logLevel,
    });

    logger.debug('Initializing stdio transport');
    const transport = new StdioServerTransport();

    // Connect to transport
    logger.debug('Connecting server to transport');
    await server.connect(transport);
    logger.info('Server connected successfully');

    // The transport itself doesn't expose error handlers, but we can handle stdio events
    process.stdin.on('error', (error) => {
      logger.error('Stdin error', { error: error.message, stack: error.stack });
      shutdown('STDIN_ERROR');
    });

    process.stdout.on('error', (error) => {
      logger.error('Stdout error', { error: error.message, stack: error.stack });
      shutdown('STDOUT_ERROR');
    });

    process.stdin.on('close', () => {
      logger.warn('Stdin closed unexpectedly');
      shutdown('STDIN_CLOSE');
    });

    process.stdin.on('end', () => {
      logger.warn('Stdin ended');
      shutdown('STDIN_END');
    });
    logger.info('MCP Agent Social Server running', {
      toolsCount: 3,
      transport: 'stdio',
    });

    // Set up graceful shutdown
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught errors to prevent sudden crashes
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      shutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      shutdown('UNHANDLED_REJECTION');
    });

    // Set up periodic session cleanup (every 30 minutes)
    cleanupInterval = setInterval(async () => {
      const removed = await sessionManager.cleanupOldSessions(3600000); // 1 hour
      if (removed > 0) {
        logger.info(`Cleaned up ${removed} old sessions`);
      }
    }, 1800000); // 30 minutes

    // Set up keepalive to prevent connection timeout
    keepAliveInterval = setInterval(() => {
      logger.debug('Keepalive ping', { uptime: process.uptime() });
    }, 30000); // Every 30 seconds
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  logger.warn(`Received ${signal}, shutting down gracefully...`);

  // Clear intervals
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }

  // Shutdown metrics collector
  metrics.shutdown();

  // Clean up sessions
  const sessionCount = sessionManager.getSessionCount();
  if (sessionCount > 0) {
    logger.info(`Cleaning up ${sessionCount} active sessions...`);
    await sessionManager.clearAllSessions();
  }

  // Close server
  try {
    await server.close();
    logger.info('Server closed successfully');
  } catch (error) {
    logger.error('Error closing server', { error });
  }

  // Exit with appropriate code
  const exitCode = signal === 'UNCAUGHT_EXCEPTION' || signal === 'UNHANDLED_REJECTION' ? 1 : 0;
  process.exit(exitCode);
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
