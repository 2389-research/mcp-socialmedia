// ABOUTME: Post resource handlers for reading individual posts and threads
// ABOUTME: Implements resource callbacks for post-related URIs

import type { URL } from 'node:url';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import type { IApiClient } from '../api-client.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { PostResource, ThreadResource } from './types.js';

export interface PostResourceContext {
  apiClient: IApiClient;
}

/**
 * Read a single post by ID
 * URI: social://posts/{postId}
 */
export async function readPostResource(
  uri: URL,
  context: PostResourceContext,
): Promise<ReadResourceResult> {
  try {
    // Extract postId from URI path
    const postId = uri.pathname.replace(/^\/\/posts\//, '');

    if (!postId) {
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify({ error: 'Invalid post URI: missing postId' }),
          },
        ],
      };
    }

    logger.debug('Reading post resource', { postId });

    // Fetch the specific post
    const response = await context.apiClient.fetchPosts(config.teamName, {
      limit: 100, // Search through recent posts
      offset: 0,
    });

    // Find the specific post
    const post = response.posts.find((p) => p.id === postId);

    if (!post) {
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify({ error: `Post not found: ${postId}` }),
          },
        ],
      };
    }

    const resource: PostResource = {
      post: {
        ...post,
        team_name: post.team_name || config.teamName,
      },
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
    logger.error('Error reading post resource', { error, uri: uri.toString() });
    return {
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'application/json',
          text: JSON.stringify({
            error: 'Failed to read post resource',
            details: error instanceof Error ? error.message : 'Unknown error',
          }),
        },
      ],
    };
  }
}

/**
 * Read a thread by thread ID
 * URI: social://threads/{threadId}
 */
export async function readThreadResource(
  uri: URL,
  context: PostResourceContext,
): Promise<ReadResourceResult> {
  try {
    // Extract threadId from URI path
    const threadId = uri.pathname.replace(/^\/\/threads\//, '');

    if (!threadId) {
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify({ error: 'Invalid thread URI: missing threadId' }),
          },
        ],
      };
    }

    logger.debug('Reading thread resource', { threadId });

    // Fetch posts in the thread
    const response = await context.apiClient.fetchPosts(config.teamName, {
      thread_id: threadId,
      limit: 100, // Get all posts in thread
      offset: 0,
    });

    if (!response.posts || response.posts.length === 0) {
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify({ error: `Thread not found: ${threadId}` }),
          },
        ],
      };
    }

    // Count unique participants
    const participants = new Set(response.posts.map((p) => p.author_name));

    const resource: ThreadResource = {
      thread: {
        threadId,
        posts: response.posts.map((p) => ({
          ...p,
          team_name: p.team_name || config.teamName,
        })),
        participantCount: participants.size,
        postCount: response.posts.length,
      },
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
    logger.error('Error reading thread resource', { error, uri: uri.toString() });
    return {
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'application/json',
          text: JSON.stringify({
            error: 'Failed to read thread resource',
            details: error instanceof Error ? error.message : 'Unknown error',
          }),
        },
      ],
    };
  }
}
