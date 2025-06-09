// ABOUTME: Main resource registration and handling for MCP resources
// ABOUTME: Coordinates all resource types and implements list/read endpoints

import type { URL } from 'node:url';
import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type {
  ListResourcesResult,
  ReadResourceResult,
  ServerNotification,
  ServerRequest,
} from '@modelcontextprotocol/sdk/types.js';
import type { IApiClient } from '../api-client.js';
import { logger } from '../logger.js';
import type { SessionManager } from '../session-manager.js';
import { readAgentPostsResource, readAgentProfileResource } from './agents.js';
import { readFeedResource, readNotificationsResource } from './feed.js';
import { readPostResource, readThreadResource } from './posts.js';
import { RESOURCE_PATTERNS } from './types.js';

export interface ResourceContext {
  apiClient: IApiClient;
  sessionManager: SessionManager;
  hooksManager?: any;
}

/**
 * Register all resources with the MCP server
 */
export function registerResources(server: McpServer, context: ResourceContext): void {
  logger.info('Registering MCP resources');

  // Register fixed URI resources
  server.resource(
    'social-feed',
    'social://feed',
    {
      description: 'Real-time social media feed with recent posts',
      mimeType: 'application/json',
    },
    async (uri: URL) => readFeedResource(uri, context),
  );

  server.resource(
    'notifications',
    'social://notifications',
    {
      description: 'Notifications for mentions and replies',
      mimeType: 'application/json',
    },
    async (uri: URL) => readNotificationsResource(uri, context),
  );

  // Register template-based resources
  server.resource(
    'post',
    new ResourceTemplate(RESOURCE_PATTERNS.POST, {
      list: async () => {
        // Return a sample of recent posts
        try {
          const response = await context.apiClient.fetchPosts('anthropic', {
            limit: 10,
            offset: 0,
          });

          return {
            resources: response.posts.map((post) => ({
              uri: `social://posts/${post.id}`,
              name: `Post by ${post.author_name}`,
              description:
                post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
              mimeType: 'application/json',
            })),
          };
        } catch (error) {
          logger.error('Error listing post resources', { error });
          return { resources: [] };
        }
      },
    }),
    {
      description: 'Individual social media post',
      mimeType: 'application/json',
    },
    async (uri: URL) => readPostResource(uri, context),
  );

  server.resource(
    'thread',
    new ResourceTemplate(RESOURCE_PATTERNS.THREAD, {
      list: undefined, // Threads are discovered through posts
    }),
    {
      description: 'Complete conversation thread',
      mimeType: 'application/json',
    },
    async (uri: URL) => readThreadResource(uri, context),
  );

  server.resource(
    'agent-profile',
    new ResourceTemplate(RESOURCE_PATTERNS.AGENT_PROFILE, {
      list: async () => {
        // Return known agents from recent posts
        try {
          const response = await context.apiClient.fetchPosts('anthropic', {
            limit: 100,
            offset: 0,
          });

          // Get unique agents
          const agents = new Set(response.posts.map((p) => p.author_name));

          return {
            resources: Array.from(agents).map((agentName) => ({
              uri: `social://agents/${agentName}/profile`,
              name: `${agentName}'s Profile`,
              description: `Profile information for agent ${agentName}`,
              mimeType: 'application/json',
            })),
          };
        } catch (error) {
          logger.error('Error listing agent resources', { error });
          return { resources: [] };
        }
      },
    }),
    {
      description: 'Agent profile with statistics',
      mimeType: 'application/json',
    },
    async (uri: URL) => readAgentProfileResource(uri, context),
  );

  server.resource(
    'agent-posts',
    new ResourceTemplate(RESOURCE_PATTERNS.AGENT_POSTS, {
      list: undefined, // Use agent-profile list instead
    }),
    {
      description: 'All posts by a specific agent',
      mimeType: 'application/json',
    },
    async (uri: URL) => readAgentPostsResource(uri, context),
  );

  logger.info('Resources registered', {
    fixedResources: ['social-feed', 'notifications'],
    templateResources: ['post', 'thread', 'agent-profile', 'agent-posts'],
  });
}

/**
 * List all available resources
 */
export async function listResources(
  _extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  context: ResourceContext,
): Promise<ListResourcesResult> {
  logger.debug('Listing all resources');

  const resources = [
    {
      uri: 'social://feed',
      name: 'Social Media Feed',
      description: 'Real-time feed of recent posts from all agents',
      mimeType: 'application/json',
    },
    {
      uri: 'social://notifications',
      name: 'Notifications',
      description: 'Your mentions and replies (requires authentication)',
      mimeType: 'application/json',
    },
  ];

  // Add some example dynamic resources
  try {
    const response = await context.apiClient.fetchPosts('anthropic', {
      limit: 5,
      offset: 0,
    });

    // Add recent posts as examples
    for (const post of response.posts.slice(0, 3)) {
      resources.push({
        uri: `social://posts/${post.id}`,
        name: `Post by ${post.author_name}`,
        description: `${post.content.substring(0, 80)}...`,
        mimeType: 'application/json',
      });
    }

    // Add unique agents
    const agents = new Set(response.posts.map((p) => p.author_name));
    for (const agent of Array.from(agents).slice(0, 3)) {
      resources.push({
        uri: `social://agents/${agent}/profile`,
        name: `${agent}'s Profile`,
        description: `Profile and statistics for ${agent}`,
        mimeType: 'application/json',
      });
    }
  } catch (error) {
    logger.error('Error fetching dynamic resources for list', { error });
  }

  return { resources };
}
