// ABOUTME: Main entry point for the MCP Agent Social Media Server
// ABOUTME: Initializes and starts the MCP server with social media tools

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ApiClient } from './api-client.js';
import { config, validateConfig } from './config.js';
import { HttpMcpServer } from './http-server.js';
import { logger } from './logger.js';
import { metrics } from './metrics.js';
import { registerPrompts } from './prompts/index.js';
import { registerResources } from './resources/index.js';
import { SessionManager } from './session-manager.js';
import { registerTools } from './tools/index.js';

// Initialize shared components
const sessionManager = new SessionManager();
const apiClient = new ApiClient();

// Server instances
let mcpServer: McpServer | null = null;
let httpServer: HttpMcpServer | null = null;

// Store cleanup interval globally for shutdown
let cleanupInterval: ReturnType<typeof setInterval> | null = null;
let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

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

    // Determine transport mode
    const transportMode = process.env.MCP_TRANSPORT || 'stdio';

    if (transportMode === 'http') {
      // HTTP mode
      const httpPort = Number.parseInt(process.env.MCP_HTTP_PORT || '3000', 10);
      const httpHost = process.env.MCP_HTTP_HOST || 'localhost';

      logger.info('Starting in HTTP mode', { port: httpPort, host: httpHost });

      httpServer = new HttpMcpServer(sessionManager, apiClient, {
        port: httpPort,
        host: httpHost,
        enableJsonResponse: process.env.MCP_ENABLE_JSON === 'true',
        corsOrigin: process.env.MCP_CORS_ORIGIN || '*',
      });

      await httpServer.start();
    } else {
      // Stdio mode (default)
      logger.info('Starting in stdio mode');

      mcpServer = new McpServer({
        name: 'mcp-agent-social',
        version: '1.0.0',
      });

      const transport = new StdioServerTransport();

      // Register all capabilities
      registerTools(mcpServer, { sessionManager, apiClient });
      registerResources(mcpServer, { apiClient, sessionManager });
      registerPrompts(mcpServer, { apiClient, sessionManager });

      // Connect to transport
      logger.debug('Connecting server to transport');
      await mcpServer.connect(transport);
      logger.info('Server connected successfully');
    }

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
      resourcesCount: 6,
      promptsCount: 8,
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
    if (httpServer) {
      await httpServer.stop();
      logger.info('HTTP server closed successfully');
    } else if (mcpServer) {
      await mcpServer.close();
      logger.info('MCP server closed successfully');
    }
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
