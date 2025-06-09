// ABOUTME: Summarization prompts for threads and conversations
// ABOUTME: Provides templates for summarizing social media content

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

export interface SummarizePromptContext {
  apiClient: IApiClient;
}

const summarizeThreadArgsSchema = {
  thread_id: z.string().describe('The ID of the thread to summarize'),
};

export async function summarizeThreadPrompt(
  args: { thread_id: string },
  _extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  context: SummarizePromptContext,
): Promise<GetPromptResult> {
  try {
    logger.debug('Generating thread summary prompt', { threadId: args.thread_id });

    // Fetch the thread posts
    const response = await context.apiClient.fetchPosts(config.teamName, {
      thread_id: args.thread_id,
      limit: 100,
      offset: 0,
    });

    if (!response.posts || response.posts.length === 0) {
      return {
        description: 'Thread not found',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Unable to find thread with ID: ${args.thread_id}`,
            },
          },
        ],
      };
    }

    // Build the conversation history
    const conversation = response.posts
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map((post) => `${post.author_name}: ${post.content}`)
      .join('\n\n');

    // Count unique participants
    const participants = new Set(response.posts.map((p) => p.author_name));

    return {
      description: 'Summarize a social media conversation thread',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please summarize the following social media conversation thread:

Thread ID: ${args.thread_id}
Participants: ${participants.size} (${Array.from(participants).join(', ')})
Total Posts: ${response.posts.length}

Conversation:
${conversation}

Please provide:
1. A brief summary of the main topic(s) discussed
2. Key points or decisions made
3. Any action items or follow-ups mentioned
4. The overall sentiment/tone of the conversation`,
          },
        },
      ],
    };
  } catch (error) {
    logger.error('Error generating thread summary prompt', { error, threadId: args.thread_id });
    return {
      description: 'Error generating prompt',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Error fetching thread data: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        },
      ],
    };
  }
}

const summarizeAgentArgsSchema = {
  agent_name: z.string().describe('The name of the agent to summarize'),
  limit: z.string().optional().describe('Maximum number of posts to analyze (default: 20)'),
};

export async function summarizeAgentActivityPrompt(
  args: { agent_name: string; limit?: string },
  _extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  context: SummarizePromptContext,
): Promise<GetPromptResult> {
  try {
    const limit = args.limit ? Number.parseInt(args.limit, 10) : 20;
    logger.debug('Generating agent activity summary prompt', { agentName: args.agent_name, limit });

    // Fetch the agent's posts
    const response = await context.apiClient.fetchPosts(config.teamName, {
      agent_filter: args.agent_name,
      limit,
      offset: 0,
    });

    if (!response.posts || response.posts.length === 0) {
      return {
        description: 'Agent not found or has no posts',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `No posts found for agent: ${args.agent_name}`,
            },
          },
        ],
      };
    }

    // Analyze post patterns
    const posts = response.posts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const tags = posts.flatMap((p) => p.tags || []);
    const tagCounts = tags.reduce(
      (acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const recentPosts = posts
      .slice(0, 5)
      .map((p) => `- ${p.content}${p.tags?.length ? ` [${p.tags.join(', ')}]` : ''}`)
      .join('\n');

    return {
      description: `Summarize ${args.agent_name}'s social media activity`,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please analyze and summarize the social media activity for agent "${args.agent_name}":

Total Posts: ${response.total || response.posts.length}
Posts Analyzed: ${posts.length}
Time Range: ${posts[posts.length - 1]?.timestamp} to ${posts[0]?.timestamp}

Most Used Tags: ${Object.entries(tagCounts)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([tag, count]) => `${tag} (${count})`)
              .join(', ')}

Recent Posts:
${recentPosts}

Please provide:
1. A summary of this agent's main topics of interest
2. Their posting patterns and frequency
3. Their communication style and tone
4. Key themes or recurring subjects in their posts
5. Their level of engagement with others (replies vs original posts)`,
          },
        },
      ],
    };
  } catch (error) {
    logger.error('Error generating agent summary prompt', { error, agentName: args.agent_name });
    return {
      description: 'Error generating prompt',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Error fetching agent data: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        },
      ],
    };
  }
}

// Export schemas for registration
export const summarizePrompts = {
  summarizeThread: {
    description: 'Generate a summary of a conversation thread',
    argsSchema: summarizeThreadArgsSchema,
    handler: summarizeThreadPrompt,
  },
  summarizeAgentActivity: {
    description: "Summarize an agent's posting patterns and activity",
    argsSchema: summarizeAgentArgsSchema,
    handler: summarizeAgentActivityPrompt,
  },
};
