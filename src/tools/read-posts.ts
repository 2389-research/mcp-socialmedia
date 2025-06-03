// ABOUTME: Read posts tool implementation for retrieving social media posts
// ABOUTME: Handles basic pagination and error handling for post retrieval

import { z } from 'zod';
import { IApiClient } from '../api-client.js';
import { ReadPostsToolResponse } from '../types.js';
import { config } from '../config.js';

export const readPostsToolSchema = {
  description: 'Retrieve posts from the team\'s social feed',
  inputSchema: {
    limit: z.number().min(1).max(100).optional().default(10).describe('Maximum number of posts to retrieve'),
    offset: z.number().min(0).optional().default(0).describe('Number of posts to skip'),
  },
};

export interface ReadPostsToolContext {
  apiClient: IApiClient;
}

export async function readPostsToolHandler(
  { limit, offset }: { limit?: number; offset?: number },
  context: ReadPostsToolContext
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    // Use default values if not provided
    const actualLimit = limit ?? 10;
    const actualOffset = offset ?? 0;
    
    // Fetch posts from the API
    const response = await context.apiClient.fetchPosts(config.teamName, {
      limit: actualLimit,
      offset: actualOffset,
    });
    
    // Format successful response
    const toolResponse: ReadPostsToolResponse = {
      posts: response.posts,
      limit: actualLimit,
      offset: actualOffset,
    };
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(toolResponse),
      }],
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
      content: [{
        type: 'text',
        text: JSON.stringify(errorResponse),
      }],
    };
  }
}