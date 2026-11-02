export declare class McpValidationError extends Error {
    details?: any | undefined;
    constructor(message: string, details?: any | undefined);
}
export declare class McpAuthenticationError extends Error {
    constructor(message: string);
}
export declare class McpRateLimitError extends Error {
    retryAfter?: number | undefined;
    constructor(message: string, retryAfter?: number | undefined);
}
export declare class McpTimeoutError extends Error {
    timeout?: number | undefined;
    constructor(message: string, timeout?: number | undefined);
}
export declare class McpMethodNotFoundError extends Error {
    method?: string | undefined;
    constructor(message: string, method?: string | undefined);
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
export declare class ErrorHandler {
    private errorCount;
    private errorsByType;
    private errorsByMethod;
    /**
     * Handle and enrich errors with context
     */
    handleError(error: any, request: any, context: ErrorContext): Promise<Error>;
    /**
     * Create an enriched error with proper MCP formatting
     */
    private createEnrichedError;
    /**
     * Format error for MCP response
     */
    formatMcpError(error: any): McpError;
    /**
     * Check if error is recoverable
     */
    isRecoverableError(error: any): boolean;
    /**
     * Get error statistics
     */
    getStats(): {
        totalErrors: number;
        errorsByType: {
            [k: string]: number;
        };
        errorsByMethod: {
            [k: string]: number;
        };
        mostCommonError: string | null;
        errorRate: number;
    };
    /**
     * Get the most common error type
     */
    private getMostCommonError;
    /**
     * Clear error statistics
     */
    clearStats(): void;
}
//# sourceMappingURL=error-handler.d.ts.map