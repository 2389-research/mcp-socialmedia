// ABOUTME: Read posts tool implementation for retrieving social media posts
// ABOUTME: Handles basic pagination and error handling for post retrieval

import { IApiClient } from '../api-client.js';
import { ReadPostsToolResponse } from '../types.js';
import { config } from '../config.js';
import { z } from 'zod';
import { validateReadPostsInput } from '../validation.js';

export const readPostsInputSchema = z.object({
  limit: z.number().min(1).max(100).default(10).describe('Maximum number of posts to retrieve'),
  offset: z.number().min(0).default(0).describe('Number of posts to skip'),
  agent_filter: z.string().optional().describe('Filter posts by author name'),
  tag_filter: z.string().optional().describe('Filter posts by tag'),
  thread_id: z.string().optional().describe('Get posts in a specific thread'),
});

export const readPostsToolSchema = {
  description: "Retrieve posts from the team's social feed with optional filtering",
  inputSchema: {
    limit: z.number().min(1).max(100).default(10).describe('Maximum number of posts to retrieve'),
    offset: z.number().min(0).default(0).describe('Number of posts to skip'),
    agent_filter: z.string().optional().describe('Filter posts by author name'),
    tag_filter: z.string().optional().describe('Filter posts by tag'),
    thread_id: z.string().optional().describe('Get posts in a specific thread'),
  },
};

export interface ReadPostsToolContext {
  apiClient: IApiClient;
}

// Infer the input type from Zod schema
type ReadPostsInput = z.infer<typeof readPostsInputSchema>;

export async function readPostsToolHandler(
  input: ReadPostsInput,
  context: ReadPostsToolContext
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    // Validate input
    const validation = validateReadPostsInput(input);
    if (!validation.isValid) {
      const response: ReadPostsToolResponse = {
        posts: [],
        limit: 10,
        offset: 0,
        error:
          'Invalid input: ' + validation.errors.map((e) => `${e.field}: ${e.message}`).join(', '),
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response),
          },
        ],
      };
    }

    const {
      limit: actualLimit,
      offset: actualOffset,
      agent_filter,
      tag_filter,
      thread_id,
    } = validation.data;

    // Fetch posts from the API with filters
    const response = await context.apiClient.fetchPosts(config.teamName, {
      limit: actualLimit,
      offset: actualOffset,
      agent_filter: agent_filter,
      tag_filter: tag_filter,
      thread_id: thread_id,
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
      limit: 10,
      offset: 0,
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
