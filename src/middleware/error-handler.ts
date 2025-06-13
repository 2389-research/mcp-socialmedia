// ABOUTME: Enhanced error handling with context enrichment and proper MCP error formatting
// ABOUTME: Provides structured error responses and comprehensive error tracking

import { logger } from '../logger.js';

// Custom error classes for better type safety
export class McpValidationError extends Error {
  constructor(
    message: string,
    public details?: any,
  ) {
    super(message);
    this.name = 'McpValidationError';
  }
}

export class McpAuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpAuthenticationError';
  }
}

export class McpRateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = 'McpRateLimitError';
  }
}

export class McpTimeoutError extends Error {
  constructor(
    message: string,
    public timeout?: number,
  ) {
    super(message);
    this.name = 'McpTimeoutError';
  }
}

export class McpMethodNotFoundError extends Error {
  constructor(
    message: string,
    public method?: string,
  ) {
    super(message);
    this.name = 'McpMethodNotFoundError';
  }
}

export interface ErrorContext {
  sessionId: string;
  requestId: string;
  method: string;
  startTime: number;
}

export interface McpError {
  code: number;
  message: string;
  data?: any;
}

export class ErrorHandler {
  private errorCount = 0;
  private errorsByType = new Map<string, number>();
  private errorsByMethod = new Map<string, number>();

  /**
   * Handle and enrich errors with context
   */
  async handleError(error: any, request: any, context: ErrorContext): Promise<Error> {
    this.errorCount++;

    const errorType = error.constructor.name;
    this.errorsByType.set(errorType, (this.errorsByType.get(errorType) || 0) + 1);
    this.errorsByMethod.set(context.method, (this.errorsByMethod.get(context.method) || 0) + 1);

    // Create enriched error
    const enrichedError = this.createEnrichedError(error, request, context);

    // Log error with context
    logger.error('Request processing error', {
      error: enrichedError.message,
      errorType,
      method: context.method,
      sessionId: context.sessionId,
      requestId: context.requestId,
      processingTime: Date.now() - context.startTime,
      originalError: error.message,
      stack: error.stack,
    });

    return enrichedError;
  }

  /**
   * Create an enriched error with proper MCP formatting
   */
  private createEnrichedError(error: any, request: any, context: ErrorContext): Error {
    let mcpError: McpError;

    // Handle known error types using proper type checking
    if (error.code && typeof error.code === 'number') {
      // Already an MCP error
      mcpError = {
        code: error.code,
        message: error.message,
        data: error.data,
      };
    } else if (error instanceof McpValidationError) {
      mcpError = {
        code: -32602, // Invalid params
        message: 'Request validation failed',
        data: {
          originalMessage: error.message,
          details: error.details,
        },
      };
    } else if (error instanceof McpTimeoutError) {
      mcpError = {
        code: -32603, // Internal error
        message: 'Request timed out',
        data: {
          timeout: error.timeout,
          method: context.method,
        },
      };
    } else if (error instanceof McpMethodNotFoundError) {
      mcpError = {
        code: -32601, // Method not found
        message: 'Method not found',
        data: {
          method: error.method || request.method,
        },
      };
    } else if (error instanceof McpAuthenticationError) {
      mcpError = {
        code: -32600, // Invalid request
        message: 'Unauthorized request',
        data: {
          sessionId: context.sessionId,
        },
      };
    } else if (error instanceof McpRateLimitError) {
      mcpError = {
        code: -32603, // Internal error
        message: 'Rate limit exceeded',
        data: {
          retryAfter: error.retryAfter || 60,
        },
      };
    } else {
      // Generic internal error
      mcpError = {
        code: -32603, // Internal error
        message: 'Internal server error',
        data: {
          originalMessage: error.message,
          type: error.constructor.name,
        },
      };
    }

    // Create final error object
    const finalError = new Error(mcpError.message);
    (finalError as any).code = mcpError.code;
    (finalError as any).data = {
      ...mcpError.data,
      context: {
        sessionId: context.sessionId,
        requestId: context.requestId,
        method: context.method,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - context.startTime,
      },
    };

    return finalError;
  }

  /**
   * Format error for MCP response
   */
  formatMcpError(error: any): McpError {
    return {
      code: error.code || -32603,
      message: error.message || 'Internal server error',
      data: error.data || null,
    };
  }

  /**
   * Check if error is recoverable
   */
  isRecoverableError(error: any): boolean {
    if (!error.code) return false;

    const recoverableCodes = [
      -32602, // Invalid params - client can fix
      -32601, // Method not found - client can fix
      -32600, // Invalid request - client can fix
    ];

    return recoverableCodes.includes(error.code);
  }

  /**
   * Get error statistics
   */
  getStats() {
    return {
      totalErrors: this.errorCount,
      errorsByType: Object.fromEntries(this.errorsByType),
      errorsByMethod: Object.fromEntries(this.errorsByMethod),
      mostCommonError: this.getMostCommonError(),
      errorRate: this.errorCount, // This would be divided by total requests in a real system
    };
  }

  /**
   * Get the most common error type
   */
  private getMostCommonError(): string | null {
    if (this.errorsByType.size === 0) return null;

    let maxCount = 0;
    let mostCommon = '';

    for (const [type, count] of this.errorsByType) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = type;
      }
    }

    return mostCommon;
  }

  /**
   * Clear error statistics
   */
  clearStats(): void {
    this.errorCount = 0;
    this.errorsByType.clear();
    this.errorsByMethod.clear();
    logger.info('Error statistics cleared');
  }
}
