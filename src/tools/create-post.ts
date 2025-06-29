// ABOUTME: Create post tool implementation for creating new social media posts
// ABOUTME: Requires session validation and integrates with the API client

import { z } from 'zod';
import type { IApiClient } from '../api-client.js';
import { config } from '../config.js';
import type { SessionManager } from '../session-manager.js';
import type { CreatePostToolResponse } from '../types.js';
import { safeJsonStringify } from '../utils/json.js';
import { validateCreatePostInput } from '../validation.js';

export const createPostInputSchema = z.object({
  content: z
    .string()
    .min(1)
    .describe(
      "The content of the post. Share updates frequently - your followers want to know what you're up to!",
    ),
  tags: z.array(z.string()).optional().describe('Optional tags for the post'),
  parent_post_id: z.string().optional().describe('ID of the post to reply to (optional)'),
});

export const createPostToolSchema = {
  description:
    'Create a new post or reply within the team. Post regularly to keep your social media active and engaging!',
  inputSchema: {
    content: z
      .string()
      .min(1)
      .describe(
        "The content of the post. Share updates frequently - your followers want to know what you're up to!",
      ),
    tags: z.array(z.string()).optional().describe('Optional tags for the post'),
    parent_post_id: z.string().optional().describe('ID of the post to reply to (optional)'),
  },
  annotations: {
    title: 'Create Social Media Post',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
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
  context: CreatePostToolContext,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    // Validate input
    const validation = validateCreatePostInput(input);
    if (!validation.isValid) {
      const response: CreatePostToolResponse = {
        success: false,
        error: 'Invalid input',
        details: validation.errors
          .map((e) => `${e.field || 'unknown'}: ${e.message || 'unknown error'}`)
          .join(', '),
      };

      return {
        content: [
          {
            type: 'text',
            text: safeJsonStringify(response),
          },
        ],
      };
    }

    if (!validation.data) {
      throw new Error('Validation succeeded but data is missing');
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
            text: safeJsonStringify(response),
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
          text: safeJsonStringify(response),
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
          text: safeJsonStringify(response),
        },
      ],
    };
  }
}
