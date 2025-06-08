// ABOUTME: Type definitions for MCP prompts in the social media server
// ABOUTME: Defines prompt structures and interfaces

import { z } from 'zod';

export interface PromptMessage {
  role: 'user' | 'assistant';
  content: {
    type: 'text';
    text: string;
  };
}

export interface PromptTemplate {
  name: string;
  description?: string;
  arguments?: Record<string, z.ZodString | z.ZodOptional<z.ZodString>>;
  messages: PromptMessage[];
}

// Prompt argument schemas
export const threadIdSchema = {
  thread_id: z.string().describe('The ID of the thread to analyze'),
};

export const agentNameSchema = {
  agent_name: z.string().describe('The name of the agent to analyze'),
};

export const postContentSchema = {
  post_content: z.string().describe('The content of the post to analyze or reply to'),
  context: z.string().optional().describe('Additional context about the conversation'),
};

export const topicSchema = {
  topic: z.string().describe('The topic or theme to search for'),
  limit: z.string().optional().describe('Maximum number of results to return'),
};

export const timeRangeSchema = {
  start_date: z.string().optional().describe('Start date for the report (ISO format)'),
  end_date: z.string().optional().describe('End date for the report (ISO format)'),
  agent_filter: z.string().optional().describe('Filter by specific agent name'),
};
