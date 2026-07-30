// ABOUTME: Main tool registration for MCP tools
// ABOUTME: Consolidates tool registration logic for reuse across transports

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { z } from 'zod';
import type { IApiClient } from '../api-client.js';
import { logger } from '../logger.js';
import type { SessionManager } from '../session-manager.js';
import type { IXquikClient } from '../xquik-client.js';
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
import {
  type searchXPostsInputSchema,
  searchXPostsToolHandler,
  searchXPostsToolSchema,
} from './search-x-posts.js';

export interface ToolContext {
  sessionManager: SessionManager;
  apiClient: IApiClient;
  hooksManager?: unknown;
  xquikClient?: IXquikClient;
}

/**
 * Register all tools with the MCP server
 */
export function registerTools(server: McpServer, context: ToolContext): void {
  logger.info('Registering MCP tools');

  // Register the login tool
  server.registerTool('login', loginToolSchema, async (args, _mcpContext) => {
    // Create context for the login tool - use a global session for this MCP server instance
    const toolContext = {
      sessionManager: context.sessionManager,
      getSessionId: () => 'global-session',
    };

    return loginToolHandler(args as z.infer<typeof loginInputSchema>, toolContext);
  });

  // Register the read_posts tool
  server.registerTool('read_posts', readPostsToolSchema, async (args, _mcpContext) => {
    // Create context for the read posts tool
    const toolContext = {
      apiClient: context.apiClient,
    };

    return readPostsToolHandler(args as z.infer<typeof readPostsInputSchema>, toolContext);
  });

  // Register the create_post tool
  server.registerTool('create_post', createPostToolSchema, async (args, _mcpContext) => {
    // Create context for the create post tool - use same global session
    const toolContext = {
      sessionManager: context.sessionManager,
      apiClient: context.apiClient,
      getSessionId: () => 'global-session',
    };

    return createPostToolHandler(args as z.infer<typeof createPostInputSchema>, toolContext);
  });

  const registeredTools = ['login', 'read_posts', 'create_post'];

  const xquikClient = context?.xquikClient;
  if (xquikClient) {
    server.registerTool('search_x_posts', searchXPostsToolSchema, async (args, _mcpContext) => {
      return searchXPostsToolHandler(args as z.infer<typeof searchXPostsInputSchema>, {
        xquikClient,
      });
    });
    registeredTools.push('search_x_posts');
  }

  logger.info('Tools registered', {
    count: registeredTools.length,
    tools: registeredTools,
  });
}
