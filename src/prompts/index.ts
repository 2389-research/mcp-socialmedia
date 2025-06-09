// ABOUTME: Main prompt registration and handling for MCP prompts
// ABOUTME: Coordinates all prompt types and implements list/get endpoints

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type {
  GetPromptResult,
  ListPromptsResult,
  ServerNotification,
  ServerRequest,
} from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';
import type { IApiClient } from '../api-client.js';
import { logger } from '../logger.js';
import type { SessionManager } from '../session-manager.js';
import { analyzePrompts } from './analyze.js';
import { generatePrompts } from './generate.js';
import { summarizePrompts } from './summarize.js';

export interface PromptContext {
  apiClient: IApiClient;
  sessionManager: SessionManager;
  hooksManager?: any;
}

// Type for prompt handlers - use any for args since prompts have different arg types
type PromptHandler<T = any> = (
  args: T,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  context: PromptContext,
) => Promise<GetPromptResult>;

interface PromptDefinition {
  description: string;
  argsSchema: Record<string, z.ZodString | z.ZodOptional<z.ZodString>>;
  handler: PromptHandler<any>;
}

// Combine all prompts
const allPrompts: Record<string, PromptDefinition> = {
  // Summarization prompts
  'summarize-thread': summarizePrompts.summarizeThread,
  'summarize-agent-activity': summarizePrompts.summarizeAgentActivity,

  // Generation prompts
  'draft-reply': generatePrompts.draftReply,
  'generate-hashtags': generatePrompts.generateHashtags,
  'create-engagement-post': generatePrompts.createEngagementPost,

  // Analysis prompts
  'analyze-sentiment': analyzePrompts.analyzeSentiment,
  'find-related-discussions': analyzePrompts.findRelatedDiscussions,
  'generate-engagement-report': analyzePrompts.generateEngagementReport,
};

/**
 * Register all prompts with the MCP server
 */
export function registerPrompts(server: McpServer, context: PromptContext): void {
  logger.info('Registering MCP prompts');

  // Register each prompt
  for (const [name, prompt] of Object.entries(allPrompts)) {
    server.prompt(
      name,
      prompt.description,
      prompt.argsSchema,
      async (args: any, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
        logger.debug(`Executing prompt: ${name}`, { args });
        return prompt.handler(args, extra, context);
      },
    );
  }

  logger.info('Prompts registered', {
    count: Object.keys(allPrompts).length,
    prompts: Object.keys(allPrompts),
  });
}

/**
 * List all available prompts
 */
export async function listPrompts(): Promise<ListPromptsResult> {
  logger.debug('Listing all prompts');

  const prompts = Object.entries(allPrompts).map(([name, prompt]) => ({
    name,
    description: prompt.description,
    arguments: Object.entries(prompt.argsSchema).map(([argName, schema]) => ({
      name: argName,
      description: schema._def.description || '',
      required: !schema.isOptional(),
    })),
  }));

  return { prompts };
}

/**
 * Get a specific prompt by name
 */
export async function getPrompt(
  name: string,
  args: Record<string, string>,
  context: PromptContext,
  extra?: RequestHandlerExtra<ServerRequest, ServerNotification>,
): Promise<GetPromptResult | null> {
  const prompt = allPrompts[name];
  if (!prompt) {
    logger.warn('Prompt not found', { name });
    return null;
  }

  // If no extra provided, this shouldn't be called directly
  if (!extra) {
    throw new Error('getPrompt requires RequestHandlerExtra parameter');
  }

  return prompt.handler(args, extra, context);
}
