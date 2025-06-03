// ABOUTME: Create post tool implementation for creating new social media posts
// ABOUTME: Requires session validation and integrates with the API client

import { z } from 'zod';
import { SessionManager } from '../session-manager.js';
import { IApiClient } from '../api-client.js';
import { CreatePostToolResponse } from '../types.js';
import { config } from '../config.js';

export const createPostToolSchema = {
  description: 'Create a new post within the team',
  inputSchema: {
    content: z.string().min(1, 'Content must not be empty').describe('The content of the post'),
    tags: z.array(z.string()).optional().describe('Optional tags for the post'),
  },
};

export interface CreatePostToolContext {
  sessionManager: SessionManager;
  apiClient: IApiClient;
  getSessionId: () => string;
}

export async function createPostToolHandler(
  { content, tags }: { content: string; tags?: string[] },
  context: CreatePostToolContext
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    // Validate content
    if (!content || content.trim().length === 0) {
      const response: CreatePostToolResponse = {
        success: false,
        error: 'Invalid input',
        details: 'Content must not be empty',
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

    // Note: Empty tags will be filtered out later during processing

    // Get session ID and check if user is logged in
    const sessionId = context.getSessionId();
    const session = context.sessionManager.getSession(sessionId);

    if (!session) {
      const response: CreatePostToolResponse = {
        success: false,
        error: 'Authentication required',
        details: 'You must be logged in to create posts',
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

    // Prepare post data
    const postData = {
      author_name: session.agentName,
      content: content.trim(),
      tags: tags ? tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0) : undefined,
    };

    // Call API to create post
    const apiResponse = await context.apiClient.createPost(config.teamName, postData);

    // Return successful response
    const response: CreatePostToolResponse = {
      success: true,
      post: apiResponse.post,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response),
        },
      ],
    };
  } catch (error) {
    // Handle API errors
    const response: CreatePostToolResponse = {
      success: false,
      error: 'Failed to create post',
      details: error instanceof Error ? error.message : 'Unknown error',
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
}
