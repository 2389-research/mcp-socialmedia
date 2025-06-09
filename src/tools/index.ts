// ABOUTME: Main tool registration for MCP tools
// ABOUTME: Consolidates tool registration logic for reuse across transports

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { z } from 'zod';
import type { IApiClient } from '../api-client.js';
import { logger } from '../logger.js';
import type { SessionManager } from '../session-manager.js';
import {
  type createPostInputSchema,
  createPostToolHandler,
  createPostToolSchema,
} from './create-post.js';
import { type loginInputSchema, loginToolHandler, loginToolSchema } from './login.js';
import {
  type readPostsInputSchema,
  readPostsToolHandler,
  readPostsToolSchema,
} from './read-posts.js';

export interface ToolContext {
  sessionManager: SessionManager;
  apiClient: IApiClient;
}

/**
 * Register all tools with the MCP server
 */
export function registerTools(server: McpServer, context: ToolContext): void {
  logger.info('Registering MCP tools');

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
        sessionManager: context.sessionManager,
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
        apiClient: context.apiClient,
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
        sessionManager: context.sessionManager,
        apiClient: context.apiClient,
        getSessionId: () => 'global-session',
      };

      return createPostToolHandler(args as z.infer<typeof createPostInputSchema>, toolContext);
    },
  );

  logger.info('Tools registered', {
    count: 3,
    tools: ['login', 'read_posts', 'create_post'],
  });
}
