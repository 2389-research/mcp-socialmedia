// ABOUTME: Analysis prompts for social media insights
// ABOUTME: Provides templates for sentiment analysis and trend detection

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
import type { Post } from '../types.js';

export interface AnalyzePromptContext {
  apiClient: IApiClient;
}

const analyzeSentimentArgsSchema = {
  scope: z.string().describe('Scope of analysis: thread, agent, tag, or recent'),
  target: z.string().optional().describe('Target ID (thread_id, agent_name, or tag)'),
};

export async function analyzeSentimentPrompt(
  args: { scope: string; target?: string },
  _extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  context: AnalyzePromptContext,
): Promise<GetPromptResult> {
  try {
    logger.debug('Generating sentiment analysis prompt', {
      scope: args.scope,
      target: args.target,
    });

    let posts: Post[] | undefined;
    let description = '';

    // Fetch posts based on scope
    switch (args.scope) {
      case 'thread': {
        if (!args.target) {
          return {
            description: 'Thread ID required',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: 'Thread ID is required for thread sentiment analysis',
                },
              },
            ],
          };
        }
        const threadResponse = await context.apiClient.fetchPosts(config.teamName, {
          thread_id: args.target,
          limit: 100,
          offset: 0,
        });
        posts = threadResponse.posts;
        description = `Thread ${args.target}`;
        break;
      }

      case 'agent': {
        if (!args.target) {
          return {
            description: 'Agent name required',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: 'Agent name is required for agent sentiment analysis',
                },
              },
            ],
          };
        }
        const agentResponse = await context.apiClient.fetchPosts(config.teamName, {
          agent_filter: args.target,
          limit: 50,
          offset: 0,
        });
        posts = agentResponse.posts;
        description = `Agent ${args.target}'s posts`;
        break;
      }

      case 'tag': {
        if (!args.target) {
          return {
            description: 'Tag required',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: 'Tag is required for tag sentiment analysis',
                },
              },
            ],
          };
        }
        const tagResponse = await context.apiClient.fetchPosts(config.teamName, {
          tag_filter: args.target,
          limit: 50,
          offset: 0,
        });
        posts = tagResponse.posts;
        description = `Posts tagged with #${args.target}`;
        break;
      }

      default: {
        const recentResponse = await context.apiClient.fetchPosts(config.teamName, {
          limit: 30,
          offset: 0,
        });
        posts = recentResponse.posts;
        description = 'Recent posts';
      }
    }

    if (!posts || posts.length === 0) {
      return {
        description: 'No posts found',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `No posts found for ${description}`,
            },
          },
        ],
      };
    }

    const postSample = posts
      .slice(0, 20)
      .map((p) => `${p.author_name}: "${p.content}"`)
      .join('\n\n');

    return {
      description: `Analyze sentiment of ${description}`,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please analyze the sentiment of the following social media posts from ${description}:

Total posts: ${posts.length}
Sample analyzed: ${Math.min(20, posts.length)}

Posts:
${postSample}

Please provide:
1. Overall sentiment (positive, negative, neutral, mixed)
2. Sentiment distribution (% positive, negative, neutral)
3. Key emotional themes detected
4. Notable sentiment shifts or patterns
5. Specific posts that exemplify the dominant sentiment
6. Any concerning or notably positive trends`,
          },
        },
      ],
    };
  } catch (error) {
    logger.error('Error generating sentiment analysis prompt', { error, scope: args.scope });
    return {
      description: 'Error generating prompt',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Error fetching data: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        },
      ],
    };
  }
}

const findRelatedArgsSchema = {
  topic: z.string().describe('The topic or keywords to search for'),
  limit: z.string().optional().describe('Maximum number of results (default: 10)'),
};

export async function findRelatedDiscussionsPrompt(
  args: { topic: string; limit?: string },
  _extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  context: AnalyzePromptContext,
): Promise<GetPromptResult> {
  try {
    const limit = args.limit ? Number.parseInt(args.limit, 10) : 10;
    logger.debug('Generating related discussions prompt', { topic: args.topic, limit });

    // Fetch recent posts to search through
    const response = await context.apiClient.fetchPosts(config.teamName, {
      limit: 100,
      offset: 0,
    });

    // Simple keyword matching (in a real system, this would be more sophisticated)
    const keywords = args.topic.toLowerCase().split(' ');
    const relevantPosts = response.posts.filter((post) => {
      const content = post.content.toLowerCase();
      return keywords.some((keyword) => content.includes(keyword));
    });

    if (relevantPosts.length === 0) {
      return {
        description: 'No related discussions found',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `No discussions found related to "${args.topic}"`,
            },
          },
        ],
      };
    }

    const discussions = relevantPosts
      .slice(0, limit)
      .map(
        (p) =>
          `[${p.id}] ${p.author_name}: "${p.content}"${p.tags?.length ? ` [${p.tags.join(', ')}]` : ''}`,
      )
      .join('\n\n');

    return {
      description: `Find discussions related to "${args.topic}"`,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Analyze the following posts related to "${args.topic}":

Found ${relevantPosts.length} related posts (showing ${Math.min(limit, relevantPosts.length)}):

${discussions}

Please provide:
1. A summary of how these posts relate to "${args.topic}"
2. Common themes or perspectives across the discussions
3. Any conflicting viewpoints or debates
4. Key insights or conclusions from the community
5. Recommendations for which threads to explore further
6. Suggested follow-up questions or topics`,
          },
        },
      ],
    };
  } catch (error) {
    logger.error('Error generating related discussions prompt', { error, topic: args.topic });
    return {
      description: 'Error generating prompt',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Error searching for discussions: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        },
      ],
    };
  }
}

const engagementReportArgsSchema = {
  time_period: z.string().optional().describe('Time period: today, week, month (default: week)'),
  focus: z.string().optional().describe('Focus area: posts, replies, tags, agents'),
};

export async function generateEngagementReportPrompt(
  args: { time_period?: string; focus?: string },
  _extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  context: AnalyzePromptContext,
): Promise<GetPromptResult> {
  try {
    const period = args.time_period || 'week';
    const focus = args.focus || 'general';

    logger.debug('Generating engagement report prompt', { period, focus });

    // Fetch posts (in a real system, would filter by time)
    const response = await context.apiClient.fetchPosts(config.teamName, {
      limit: 100,
      offset: 0,
    });

    // Analyze engagement patterns
    const posts = response.posts;
    const authors = new Set(posts.map((p) => p.author_name));
    const threads = new Set(posts.filter((p) => p.parent_post_id).map((p) => p.parent_post_id));
    const tags = posts.flatMap((p) => p.tags || []);
    const tagCounts = tags.reduce(
      (acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([tag, count]) => `#${tag} (${count} uses)`)
      .join(', ');

    const originalPosts = posts.filter((p) => !p.parent_post_id).length;
    const replies = posts.filter((p) => p.parent_post_id).length;

    return {
      description: `Generate ${period} engagement report`,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Generate an engagement report for the ${period} with focus on ${focus}:

Data Summary:
- Total Posts: ${posts.length}
- Original Posts: ${originalPosts}
- Replies: ${replies}
- Active Users: ${authors.size}
- Active Threads: ${threads.size}
- Top Tags: ${topTags || 'none'}

Time Range: ${posts[posts.length - 1]?.timestamp} to ${posts[0]?.timestamp}

Please create a comprehensive engagement report including:

1. Executive Summary
   - Key metrics and trends
   - Engagement rate (replies vs original posts)
   - User participation levels

2. Content Analysis
   - Most discussed topics
   - Popular content types
   - Viral posts or threads

3. User Behavior
   - Most active contributors
   - New vs returning users
   - Engagement patterns

4. Insights & Recommendations
   - What's working well
   - Areas for improvement
   - Suggested actions to increase engagement

5. ${focus === 'general' ? 'Overall trends' : `Specific ${focus} analysis`}`,
          },
        },
      ],
    };
  } catch (error) {
    logger.error('Error generating engagement report prompt', { error });
    return {
      description: 'Error generating prompt',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Error generating report: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        },
      ],
    };
  }
}

// Export schemas for registration
export const analyzePrompts = {
  analyzeSentiment: {
    description: 'Analyze sentiment of posts by thread, agent, tag, or recent',
    argsSchema: analyzeSentimentArgsSchema,
    handler: analyzeSentimentPrompt,
  },
  findRelatedDiscussions: {
    description: 'Find discussions related to a specific topic',
    argsSchema: findRelatedArgsSchema,
    handler: findRelatedDiscussionsPrompt,
  },
  generateEngagementReport: {
    description: 'Generate engagement analytics and insights',
    argsSchema: engagementReportArgsSchema,
    handler: generateEngagementReportPrompt,
  },
};
