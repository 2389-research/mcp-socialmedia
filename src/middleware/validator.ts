// ABOUTME: Protocol-level request and response validation
// ABOUTME: Ensures MCP protocol compliance and data integrity

import { z } from 'zod';
import { logger } from '../logger.js';

// Base MCP request schema
const McpRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  method: z.string(),
  params: z.record(z.any()).optional(),
});

// Base MCP response schema
const McpResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  result: z.any().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
      data: z.any().optional(),
    })
    .optional(),
});

// Method-specific validation schemas (only validate params, base structure already validated)
const MethodSchemas = {
  'tools/list': {
    request: z.object({
      params: z.object({}).optional(),
    }),
    response: z.object({
      tools: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          inputSchema: z.record(z.any()),
        }),
      ),
    }),
  },
  'tools/call': {
    request: z.object({
      params: z.object({
        name: z.string(),
        arguments: z.record(z.any()).optional(),
      }),
    }),
    response: z.object({
      content: z.array(
        z.object({
          type: z.string(),
          text: z.string().optional(),
          data: z.any().optional(),
        }),
      ),
    }),
  },
  'resources/list': {
    request: z.object({
      params: z
        .object({
          cursor: z.string().optional(),
        })
        .optional(),
    }),
    response: z.object({
      resources: z.array(
        z.object({
          uri: z.string(),
          name: z.string(),
          description: z.string().optional(),
          mimeType: z.string().optional(),
        }),
      ),
    }),
  },
};

export class RequestValidator {
  private validationCount = 0;
  private validationErrors = 0;

  /**
   * Validate an MCP request
   */
  async validateRequest(request: any): Promise<void> {
    this.validationCount++;

    try {
      // Validate base MCP structure
      McpRequestSchema.parse(request);

      // Then validate method-specific params only (avoiding redundant validation)
      const methodSchema = MethodSchemas[request.method as keyof typeof MethodSchemas];
      if (methodSchema?.request) {
        // Extract just the params and validate them separately
        const paramsToValidate = { params: request.params };
        methodSchema.request.parse(paramsToValidate);
      }

      // Additional custom validations
      await this.performCustomValidations(request);

      logger.debug('Request validation passed', {
        method: request.method,
        id: request.id,
      });
    } catch (error) {
      this.validationErrors++;

      if (error instanceof z.ZodError) {
        const validationError = new Error(
          `Request validation failed: ${error.errors.map((e) => e.message).join(', ')}`,
        );
        (validationError as any).code = -32602; // Invalid params
        (validationError as any).data = error.errors;
        throw validationError;
      }

      throw error;
    }
  }

  /**
   * Validate an MCP response
   */
  async validateResponse(response: any, method: string): Promise<void> {
    try {
      // Validate base response structure
      McpResponseSchema.parse(response);

      // Validate method-specific response if available
      const methodSchema = MethodSchemas[method as keyof typeof MethodSchemas];
      if (methodSchema?.response && response.result) {
        methodSchema.response.parse(response.result);
      }

      logger.debug('Response validation passed', { method });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = new Error(
          `Response validation failed: ${error.errors.map((e) => e.message).join(', ')}`,
        );
        (validationError as any).code = -32603; // Internal error
        (validationError as any).data = error.errors;
        throw validationError;
      }

      throw error;
    }
  }

  /**
   * Perform additional custom validations
   */
  private async performCustomValidations(request: any): Promise<void> {
    // Validate content length limits
    if (request.params) {
      const stringContent = JSON.stringify(request.params);
      if (stringContent.length > 100000) {
        // 100KB limit
        throw new Error('Request payload exceeds maximum size limit');
      }
    }

    // Validate method exists
    const allowedMethods = [
      'tools/list',
      'tools/call',
      'resources/list',
      'resources/read',
      'prompts/list',
      'prompts/get',
      'sampling/create',
      'roots/list',
    ];

    if (!allowedMethods.includes(request.method)) {
      const error = new Error(`Method not found: ${request.method}`);
      (error as any).code = -32601;
      throw error;
    }

    // Validate specific parameter constraints
    if (request.method === 'sampling/create' && request.params?.messages) {
      const messageCount = request.params.messages.length;
      if (messageCount > 50) {
        throw new Error('Too many messages in sampling request (max 50)');
      }

      for (const message of request.params.messages) {
        if (message.content.length > 10000) {
          throw new Error('Message content exceeds maximum length (10000 characters)');
        }
      }
    }
  }

  /**
   * Get validation statistics
   */
  getStats() {
    return {
      totalValidations: this.validationCount,
      validationErrors: this.validationErrors,
      successRate:
        this.validationCount > 0
          ? (this.validationCount - this.validationErrors) / this.validationCount
          : 1,
    };
  }
}
