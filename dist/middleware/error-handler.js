// ABOUTME: Enhanced error handling with context enrichment and proper MCP error formatting
// ABOUTME: Provides structured error responses and comprehensive error tracking
import { logger } from '../logger.js';
// Custom error classes for better type safety
export class McpValidationError extends Error {
    details;
    constructor(message, details) {
        super(message);
        this.details = details;
        this.name = 'McpValidationError';
    }
}
export class McpAuthenticationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'McpAuthenticationError';
    }
}
export class McpRateLimitError extends Error {
    retryAfter;
    constructor(message, retryAfter) {
        super(message);
        this.retryAfter = retryAfter;
        this.name = 'McpRateLimitError';
    }
}
export class McpTimeoutError extends Error {
    timeout;
    constructor(message, timeout) {
        super(message);
        this.timeout = timeout;
        this.name = 'McpTimeoutError';
    }
}
export class McpMethodNotFoundError extends Error {
    method;
    constructor(message, method) {
        super(message);
        this.method = method;
        this.name = 'McpMethodNotFoundError';
    }
}
export class ErrorHandler {
    errorCount = 0;
    errorsByType = new Map();
    errorsByMethod = new Map();
    /**
     * Handle and enrich errors with context
     */
    async handleError(error, request, context) {
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
    createEnrichedError(error, request, context) {
        let mcpError;
        // Handle known error types using proper type checking
        if (error.code && typeof error.code === 'number') {
            // Already an MCP error
            mcpError = {
                code: error.code,
                message: error.message,
                data: error.data,
            };
        }
        else if (error instanceof McpValidationError) {
            mcpError = {
                code: -32602, // Invalid params
                message: 'Request validation failed',
                data: {
                    originalMessage: error.message,
                    details: error.details,
                },
            };
        }
        else if (error instanceof McpTimeoutError) {
            mcpError = {
                code: -32603, // Internal error
                message: 'Request timed out',
                data: {
                    timeout: error.timeout,
                    method: context.method,
                },
            };
        }
        else if (error instanceof McpMethodNotFoundError) {
            mcpError = {
                code: -32601, // Method not found
                message: 'Method not found',
                data: {
                    method: error.method || request.method,
                },
            };
        }
        else if (error instanceof McpAuthenticationError) {
            mcpError = {
                code: -32600, // Invalid request
                message: 'Unauthorized request',
                data: {
                    sessionId: context.sessionId,
                },
            };
        }
        else if (error instanceof McpRateLimitError) {
            mcpError = {
                code: -32603, // Internal error
                message: 'Rate limit exceeded',
                data: {
                    retryAfter: error.retryAfter || 60,
                },
            };
        }
        else {
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
        finalError.code = mcpError.code;
        finalError.data = {
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
    formatMcpError(error) {
        return {
            code: error.code || -32603,
            message: error.message || 'Internal server error',
            data: error.data || null,
        };
    }
    /**
     * Check if error is recoverable
     */
    isRecoverableError(error) {
        if (!error.code)
            return false;
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
    getMostCommonError() {
        if (this.errorsByType.size === 0)
            return null;
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
    clearStats() {
        this.errorCount = 0;
        this.errorsByType.clear();
        this.errorsByMethod.clear();
        logger.info('Error statistics cleared');
    }
}
//# sourceMappingURL=error-handler.js.map