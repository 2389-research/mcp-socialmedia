// ABOUTME: MCP Sampling implementation for LLM request forwarding
// ABOUTME: Handles sampling/create requests and template management

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../logger.js';
import { SamplingCreateRequestSchema, type SamplingRequest } from './types.js';
import { SamplingTemplates } from './templates.js';

interface SamplingContext {
  apiClient: any;
  sessionManager: any;
  hooksManager?: any;
}

export function registerSampling(server: McpServer, context: SamplingContext) {
  server.registerTool(
    'sampling_create',
    {
      description: 'Create a sampling request to forward to an LLM model',
      inputSchema: {
        model: SamplingCreateRequestSchema.shape.model,
        messages: SamplingCreateRequestSchema.shape.messages,
        maxTokens: SamplingCreateRequestSchema.shape.maxTokens,
        temperature: SamplingCreateRequestSchema.shape.temperature,
        includeContext: SamplingCreateRequestSchema.shape.includeContext,
        template: SamplingCreateRequestSchema.shape.template
      }
    },
    async (args) => {
      try {
        logger.debug('Processing sampling create request', { args });

        // Validate request parameters
        const validatedParams = SamplingCreateRequestSchema.parse(args);
        const { model, messages, maxTokens, temperature, includeContext, template } = validatedParams;

        // Apply template if specified
        let processedMessages = messages;
        if (template) {
          const templateProcessor = SamplingTemplates.getTemplate(template);
          if (templateProcessor) {
            processedMessages = await templateProcessor.process(messages, context);
          }
        }

        // Add context if requested
        if (includeContext) {
          // Get current session context
          const sessions = context.sessionManager.getAllSessions();
          if (sessions.length > 0) {
            const contextMessage = {
              role: 'system' as const,
              content: `Context: Currently logged in as agent. Available capabilities: read posts, create posts, access feed and agent profiles.`
            };
            processedMessages = [contextMessage, ...processedMessages];
          }
        }

        // Prepare sampling request
        const samplingRequest: SamplingRequest = {
          model: model || 'claude-3-sonnet-20240229',
          messages: processedMessages,
          maxTokens: maxTokens || 1000,
          temperature: temperature || 0.7,
          stream: false // We don't support streaming in this implementation
        };

        logger.info('Forwarding sampling request', {
          model: samplingRequest.model,
          messageCount: samplingRequest.messages.length,
          maxTokens: samplingRequest.maxTokens,
          temperature: samplingRequest.temperature,
          template: template
        });

        // Note: In a real implementation, this would forward to an actual LLM API
        // For now, we'll return a simulated response
        const response = `This is a simulated response for the sampling request with ${samplingRequest.messages.length} messages. In a production environment, this would be forwarded to the specified model (${samplingRequest.model}).`;

        return {
          content: [
            {
              type: 'text',
              text: response
            }
          ]
        };

      } catch (error) {
        logger.error('Error in sampling create', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });

        throw error;
      }
    }
  );

  logger.info('Sampling tool registered');
}
