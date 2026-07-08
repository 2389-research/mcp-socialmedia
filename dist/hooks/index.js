// ABOUTME: MCP Request/Response Hooks for middleware architecture and custom processing
// ABOUTME: Provides extensible pipeline for request preprocessing and response enrichment
import { logger } from '../logger.js';
import { McpRateLimitError } from '../middleware/error-handler.js';
export class HooksManager {
    requestHooks = [];
    responseHooks = [];
    errorHooks = [];
    rateLimitWindows = new Map();
    constructor() {
        // Register default hooks
        this.registerDefaultHooks();
        logger.info('Hooks manager initialized', {
            requestHooks: this.requestHooks.length,
            responseHooks: this.responseHooks.length,
            errorHooks: this.errorHooks.length,
        });
    }
    /**
     * Register a hook
     */
    registerHook(hook) {
        switch (hook.type) {
            case 'request':
                this.requestHooks.push(hook);
                this.requestHooks.sort((a, b) => a.priority - b.priority);
                break;
            case 'response':
                this.responseHooks.push(hook);
                this.responseHooks.sort((a, b) => a.priority - b.priority);
                break;
            case 'error':
                this.errorHooks.push(hook);
                this.errorHooks.sort((a, b) => a.priority - b.priority);
                break;
        }
        logger.debug('Registered hook', { name: hook.name, type: hook.type, priority: hook.priority });
    }
    /**
     * Process request through all request hooks
     */
    async processRequest(request, context) {
        let processedRequest = request;
        for (const hook of this.requestHooks) {
            try {
                if (hook.condition && !hook.condition(processedRequest, context)) {
                    continue;
                }
                const result = await hook.execute(processedRequest, context);
                if (result) {
                    processedRequest = result;
                }
                logger.debug('Request hook executed', {
                    hookName: hook.name,
                    method: processedRequest.method,
                });
            }
            catch (error) {
                logger.error('Request hook failed', {
                    hookName: hook.name,
                    error: error instanceof Error ? error.message : String(error),
                });
                // Don't fail the entire request for hook errors
                if (hook.critical) {
                    throw error;
                }
            }
        }
        return processedRequest;
    }
    /**
     * Process response through all response hooks
     */
    async processResponse(response, request, context) {
        let processedResponse = response;
        for (const hook of this.responseHooks) {
            try {
                if (hook.condition && !hook.condition(processedResponse, request, context)) {
                    continue;
                }
                const result = await hook.execute(processedResponse, request, context);
                if (result) {
                    processedResponse = result;
                }
                logger.debug('Response hook executed', {
                    hookName: hook.name,
                    method: request.method,
                });
            }
            catch (error) {
                logger.error('Response hook failed', {
                    hookName: hook.name,
                    error: error instanceof Error ? error.message : String(error),
                });
                if (hook.critical) {
                    throw error;
                }
            }
        }
        return processedResponse;
    }
    /**
     * Process error through all error hooks
     */
    async processError(error, request, context) {
        let processedError = error;
        for (const hook of this.errorHooks) {
            try {
                if (hook.condition && !hook.condition(processedError, request, context)) {
                    continue;
                }
                const result = await hook.execute(processedError, request, context);
                if (result) {
                    processedError = result;
                }
                logger.debug('Error hook executed', {
                    hookName: hook.name,
                    originalError: error.message,
                });
            }
            catch (hookError) {
                logger.error('Error hook failed', {
                    hookName: hook.name,
                    hookError: hookError instanceof Error ? hookError.message : String(hookError),
                });
            }
        }
        return processedError;
    }
    /**
     * Register default hooks
     */
    registerDefaultHooks() {
        // Request logging hook
        this.registerHook({
            name: 'request-logger',
            type: 'request',
            priority: 100,
            description: 'Log incoming requests',
            execute: async (request, context) => {
                logger.info('Processing request', {
                    method: request.method,
                    sessionId: context.sessionId,
                    timestamp: new Date().toISOString(),
                });
                return request;
            },
        });
        // Response enrichment hook
        this.registerHook({
            name: 'response-enricher',
            type: 'response',
            priority: 100,
            description: 'Add metadata to responses',
            execute: async (response, request, context) => {
                const enrichedResponse = {
                    ...response,
                    _metadata: {
                        processedAt: new Date().toISOString(),
                        sessionId: context.sessionId,
                        requestMethod: request.method,
                    },
                };
                return enrichedResponse;
            },
        });
        // Error enrichment hook
        this.registerHook({
            name: 'error-enricher',
            type: 'error',
            priority: 100,
            description: 'Enrich errors with context',
            execute: async (error, request, context) => {
                const enrichedError = new Error(error.message);
                enrichedError.name = error.name;
                enrichedError.stack = error.stack;
                // Add context to error
                enrichedError.context = {
                    method: request.method,
                    sessionId: context.sessionId,
                    timestamp: new Date().toISOString(),
                };
                return enrichedError;
            },
        });
        // Rate limiting hook with sliding window implementation
        this.registerHook({
            name: 'rate-limiter',
            type: 'request',
            priority: 10, // High priority - run early
            description: 'Sliding window rate limiting',
            critical: true, // Rate limit errors should stop request processing
            execute: async (request, context) => {
                const rateLimitKey = `${context.sessionId}:${request.method}`;
                const now = Date.now();
                const windowMs = 60000; // 1 minute window
                const maxRequests = 30; // Standard rate limit
                if (!this.rateLimitWindows) {
                    this.rateLimitWindows = new Map();
                }
                let requestTimes = this.rateLimitWindows.get(rateLimitKey) || [];
                // Remove requests older than window
                requestTimes = requestTimes.filter((time) => now - time < windowMs);
                // Check if limit exceeded
                if (requestTimes.length >= maxRequests) {
                    const oldestRequest = Math.min(...requestTimes);
                    const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);
                    logger.warn('Rate limit exceeded', {
                        key: rateLimitKey,
                        requestCount: requestTimes.length,
                        maxRequests,
                        retryAfter,
                    });
                    throw new McpRateLimitError(`Rate limit exceeded. Too many ${request.method} requests. Try again in ${retryAfter} seconds.`, retryAfter);
                }
                // Add current request time
                requestTimes.push(now);
                this.rateLimitWindows.set(rateLimitKey, requestTimes);
                logger.debug('Rate limit check passed', {
                    key: rateLimitKey,
                    currentCount: requestTimes.length,
                    maxRequests,
                });
                return request;
            },
        });
    }
    /**
     * Get all registered hooks
     */
    getAllHooks() {
        return [...this.requestHooks, ...this.responseHooks, ...this.errorHooks];
    }
    /**
     * Remove a hook by name
     */
    removeHook(name) {
        const removeFromArray = (arr) => {
            const index = arr.findIndex((hook) => hook.name === name);
            if (index !== -1) {
                arr.splice(index, 1);
                return true;
            }
            return false;
        };
        return (removeFromArray(this.requestHooks) ||
            removeFromArray(this.responseHooks) ||
            removeFromArray(this.errorHooks));
    }
}
// Global hooks manager instance
export const hooksManager = new HooksManager();
//# sourceMappingURL=index.js.map