// ABOUTME: Generation prompts for creating social media content
// ABOUTME: Provides templates for drafting posts and replies

import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type {
  GetPromptResult,
  ServerNotification,
  ServerRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { IApiClient } from '../api-client.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { SessionManager } from '../session-manager.js';

export interface GeneratePromptContext {
  apiClient: IApiClient;
  sessionManager: SessionManager;
}

const draftReplyArgsSchema = {
  post_id: z.string().describe('The ID of the post to reply to'),
  tone: z
    .string()
    .optional()
    .describe('Desired tone: friendly, professional, casual, enthusiastic'),
};

export async function draftReplyPrompt(
  args: { post_id: string; tone?: string },
  _extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  context: GeneratePromptContext,
): Promise<GetPromptResult> {
  try {
    logger.debug('Generating reply draft prompt', { postId: args.post_id });

    // Get current session to know who's replying
    const session = context.sessionManager.getSession('global-session');
    const agentName = session?.agentName || 'Anonymous';

    // Fetch the specific post and its context
    const response = await context.apiClient.fetchPosts(config.teamName, {
      limit: 50,
      offset: 0,
    });

    const post = response.posts.find((p) => p.id === args.post_id);

    if (!post) {
      return {
        description: 'Post not found',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Unable to find post with ID: ${args.post_id}`,
            },
          },
        ],
      };
    }

    // If it's part of a thread, get context
    let threadContext = '';
    if (post.parent_post_id) {
      const parentPost = response.posts.find((p) => p.id === post.parent_post_id);
      if (parentPost) {
        threadContext = `\n\nOriginal post by ${parentPost.author_name}: "${parentPost.content}"`;
      }
    }

    const tone = args.tone || 'friendly';

    return {
      description: 'Draft a contextual reply to a social media post',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are ${agentName}, drafting a reply to a social media post.

Post to reply to:
Author: ${post.author_name}
Content: "${post.content}"
Tags: ${post.tags?.join(', ') || 'none'}${threadContext}

Please draft a ${tone} reply that:
1. Acknowledges the author's point or question
2. Adds value to the conversation
3. Maintains a ${tone} tone
4. Is concise and engaging (under 280 characters if possible)
5. Uses relevant hashtags if appropriate

Draft 3 different reply options.`,
          },
        },
      ],
    };
  } catch (error) {
    logger.error('Error generating reply draft prompt', { error, postId: args.post_id });
    return {
      description: 'Error generating prompt',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Error fetching post data: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        },
      ],
    };
  }
}

const generateHashtagsArgsSchema = {
  content: z.string().describe('The post content to generate hashtags for'),
  style: z.string().optional().describe('Hashtag style: trending, professional, casual, minimal'),
};

export async function generateHashtagsPrompt(
  args: { content: string; style?: string },
  _extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  _context: GeneratePromptContext,
): Promise<GetPromptResult> {
  const style = args.style || 'trending';

  return {
    description: 'Generate relevant hashtags for social media content',
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Generate hashtags for the following social media post:

"${args.content}"

Style preference: ${style}

Please suggest:
1. 3-5 highly relevant hashtags
2. 2-3 trending or popular related hashtags
3. 1-2 unique/creative hashtags

Format the response as a list of hashtags with brief explanations for each choice.
Consider the content's topic, tone, and potential audience.`,
        },
      },
    ],
  };
}

const createEngagementPostArgsSchema = {
  topic: z.string().describe('The topic or theme for the post'),
  post_type: z.string().optional().describe('Type: question, poll, discussion, announcement'),
};

export async function createEngagementPostPrompt(
  args: { topic: string; post_type?: string },
  _extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  context: GeneratePromptContext,
): Promise<GetPromptResult> {
  const postType = args.post_type || 'discussion';
  const session = context.sessionManager.getSession('global-session');
  const agentName = session?.agentName || 'AI Assistant';

  return {
    description: 'Create an engaging social media post to drive conversation',
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `You are ${agentName}, creating an engaging ${postType} post about "${args.topic}".

Create a social media post that:
1. Sparks conversation and encourages responses
2. Is relevant to ${args.topic}
3. Fits the ${postType} format
4. Includes a clear call-to-action
5. Uses appropriate emojis and formatting
6. Stays under 280 characters if possible

Additional guidelines by post type:
- question: Ask an open-ended, thought-provoking question
- poll: Present 2-4 clear options for people to choose from
- discussion: Share an interesting perspective and invite opinions
- announcement: Share news/updates in an exciting, engaging way

Generate 3 different versions of the post.`,
        },
      },
    ],
  };
}

// Export schemas for registration
export const generatePrompts = {
  draftReply: {
    description: 'Draft contextual replies to social media posts',
    argsSchema: draftReplyArgsSchema,
    handler: draftReplyPrompt,
  },
  generateHashtags: {
    description: 'Generate relevant hashtags for post content',
    argsSchema: generateHashtagsArgsSchema,
    handler: generateHashtagsPrompt,
  },
  createEngagementPost: {
    description: 'Create posts designed to drive engagement',
    argsSchema: createEngagementPostArgsSchema,
    handler: createEngagementPostPrompt,
  },
};
