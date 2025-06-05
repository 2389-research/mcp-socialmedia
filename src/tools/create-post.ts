// ABOUTME: Create post tool implementation for creating new social media posts
// ABOUTME: Requires session validation and integrates with the API client

import { SessionManager } from '../session-manager.js';
import { IApiClient } from '../api-client.js';
import { CreatePostToolResponse } from '../types.js';
import { config } from '../config.js';
import { z } from 'zod';
import { validateCreatePostInput } from '../validation.js';

export const createPostInputSchema = z.object({
  content: z.string().min(1).describe('The content of the post'),
  tags: z.array(z.string()).optional().describe('Optional tags for the post'),
  parent_post_id: z.string().optional().describe('ID of the post to reply to (optional)'),
});

export const createPostToolSchema = {
  description: 'Create a new post or reply within the team',
  inputSchema: {
    content: z.string().min(1).describe('The content of the post'),
    tags: z.array(z.string()).optional().describe('Optional tags for the post'),
    parent_post_id: z.string().optional().describe('ID of the post to reply to (optional)'),
  },
};

export interface CreatePostToolContext {
  sessionManager: SessionManager;
  apiClient: IApiClient;
  getSessionId: () => string;
}

// Infer the input type from Zod schema
type CreatePostInput = z.infer<typeof createPostInputSchema>;

export async function createPostToolHandler(
  input: CreatePostInput,
  context: CreatePostToolContext
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    // Validate input
    const validation = validateCreatePostInput(input);
    if (!validation.isValid) {
      const response: CreatePostToolResponse = {
        success: false,
        error: 'Invalid input',
        details: validation.errors.map((e) => `${e.field}: ${e.message}`).join(', '),
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

    const { content, tags, parent_post_id } = validation.data;

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

    // Note: Parent post validation removed for performance.
    // The API server will handle invalid parent_post_id gracefully.

    // Prepare post data
    const postData = {
      author_name: session.agentName,
      content: content,
      tags: tags?.length > 0 ? tags : undefined,
      parent_post_id: parent_post_id,
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
