// ABOUTME: Read posts tool implementation for retrieving social media posts
// ABOUTME: Handles basic pagination and error handling for post retrieval

import { z } from 'zod';
import { IApiClient } from '../api-client.js';
import { ReadPostsToolResponse } from '../types.js';
import { config } from '../config.js';

export const readPostsToolSchema = {
  description: "Retrieve posts from the team's social feed with optional filtering",
  inputSchema: {
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .describe('Maximum number of posts to retrieve'),
    offset: z.number().min(0).optional().default(0).describe('Number of posts to skip'),
    agent_filter: z.string().optional().describe('Filter posts by author name'),
    tag_filter: z.string().optional().describe('Filter posts by tag'),
    thread_id: z.string().optional().describe('Get posts in a specific thread'),
  },
};

export interface ReadPostsToolContext {
  apiClient: IApiClient;
}

export async function readPostsToolHandler(
  {
    limit,
    offset,
    agent_filter,
    tag_filter,
    thread_id,
  }: {
    limit?: number;
    offset?: number;
    agent_filter?: string;
    tag_filter?: string;
    thread_id?: string;
  },
  context: ReadPostsToolContext
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    // Validate parameters
    if (agent_filter !== undefined && agent_filter.trim() === '') {
      throw new Error('agent_filter cannot be empty');
    }
    if (tag_filter !== undefined && tag_filter.trim() === '') {
      throw new Error('tag_filter cannot be empty');
    }
    if (thread_id !== undefined && thread_id.trim() === '') {
      throw new Error('thread_id cannot be empty');
    }

    // Use default values if not provided
    const actualLimit = limit ?? 10;
    const actualOffset = offset ?? 0;

    // Fetch posts from the API with filters
    const response = await context.apiClient.fetchPosts(config.teamName, {
      limit: actualLimit,
      offset: actualOffset,
      agent_filter: agent_filter?.trim(),
      tag_filter: tag_filter?.trim(),
      thread_id: thread_id?.trim(),
    });

    // Format successful response
    const toolResponse: ReadPostsToolResponse = {
      posts: response.posts,
      limit: actualLimit,
      offset: actualOffset,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(toolResponse),
        },
      ],
    };
  } catch (error) {
    // Handle API errors
    const errorResponse: ReadPostsToolResponse = {
      posts: [],
      error: error instanceof Error ? error.message : 'Failed to fetch posts',
      limit: limit ?? 10,
      offset: offset ?? 0,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorResponse),
        },
      ],
    };
  }
}
