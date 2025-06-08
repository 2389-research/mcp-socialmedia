// ABOUTME: Feed and notifications resource handlers
// ABOUTME: Implements resource callbacks for feed and notification URIs

import type { URL } from 'node:url';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import type { IApiClient } from '../api-client.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { SessionManager } from '../session-manager.js';
import type { FeedResource, NotificationsResource } from './types.js';

export interface FeedResourceContext {
  apiClient: IApiClient;
  sessionManager: SessionManager;
}

/**
 * Read the social feed
 * URI: social://feed
 */
export async function readFeedResource(
  uri: URL,
  context: FeedResourceContext,
): Promise<ReadResourceResult> {
  try {
    logger.debug('Reading feed resource');

    // Fetch recent posts for the feed
    const response = await context.apiClient.fetchPosts(config.teamName, {
      limit: 25, // Reasonable feed size
      offset: 0,
    });

    const resource: FeedResource = {
      posts: response.posts.map((p) => ({
        ...p,
        team_name: p.team_name || config.teamName,
      })),
      lastUpdated: Date.now(),
    };

    return {
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'application/json',
          text: JSON.stringify(resource, null, 2),
        },
      ],
    };
  } catch (error) {
    logger.error('Error reading feed resource', { error, uri: uri.toString() });
    return {
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'application/json',
          text: JSON.stringify({
            error: 'Failed to read feed resource',
            details: error instanceof Error ? error.message : 'Unknown error',
          }),
        },
      ],
    };
  }
}

/**
 * Read notifications (mentions and replies)
 * URI: social://notifications
 */
export async function readNotificationsResource(
  uri: URL,
  context: FeedResourceContext,
): Promise<ReadResourceResult> {
  try {
    logger.debug('Reading notifications resource');

    // Get current session to find logged-in agent
    const session = context.sessionManager.getSession('global-session');

    if (!session) {
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify({
              error: 'Not authenticated',
              details: 'You must be logged in to view notifications',
            }),
          },
        ],
      };
    }

    // Fetch all recent posts to find mentions and replies
    const response = await context.apiClient.fetchPosts(config.teamName, {
      limit: 100,
      offset: 0,
    });

    const notifications: NotificationsResource['notifications'] = [];

    // Find posts that mention the current agent or are replies to their posts
    const agentPosts = new Set(
      response.posts.filter((p) => p.author_name === session.agentName).map((p) => p.id),
    );

    for (const post of response.posts) {
      // Skip own posts
      if (post.author_name === session.agentName) continue;

      // Check for mentions
      if (post.content.includes(`@${session.agentName}`)) {
        notifications.push({
          type: 'mention',
          id: post.id,
          author_name: post.author_name,
          content: post.content,
          timestamp: post.timestamp,
        });
      }

      // Check for replies to agent's posts
      if (post.parent_post_id && agentPosts.has(post.parent_post_id)) {
        notifications.push({
          type: 'reply',
          id: post.id,
          author_name: post.author_name,
          content: post.content,
          timestamp: post.timestamp,
        });
      }
    }

    // Sort by date, newest first
    notifications.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const resource: NotificationsResource = {
      notifications: notifications.slice(0, 20), // Limit to 20 most recent
      unreadCount: notifications.length,
    };

    return {
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'application/json',
          text: JSON.stringify(resource, null, 2),
        },
      ],
    };
  } catch (error) {
    logger.error('Error reading notifications resource', { error, uri: uri.toString() });
    return {
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'application/json',
          text: JSON.stringify({
            error: 'Failed to read notifications resource',
            details: error instanceof Error ? error.message : 'Unknown error',
          }),
        },
      ],
    };
  }
}
