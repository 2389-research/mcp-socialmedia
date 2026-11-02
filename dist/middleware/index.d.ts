export interface MiddlewareContext {
    sessionId: string;
    startTime: number;
    requestId: string;
    method: string;
}
export declare class ProtocolMiddleware {
    private validator;
    private errorHandler;
    private timeoutManager;
    constructor();
    /**
     * Process request through validation and preprocessing
     */
    processRequest(request: any, context: MiddlewareContext): Promise<any>;
    /**
     * Process response through enrichment and validation
     */
    processResponse(response: any, request: any, context: MiddlewareContext): Promise<any>;
    private doProcessRequest;
    /**
     * Get middleware statistics
     */
    getStats(): {
        validator: {
            totalValidations: number;
            validationErrors: number;
            successRate: number;
        };
        errorHandler: {
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
        timeoutManager: {
            totalTimeouts: number;
            activeTimeouts: number;
            config: {
                defaultTimeout: number;
                maxTimeout: number;
                methodTimeoutCount: number;
            };
        };
    };
}
export { RequestValidator } from './validator.js';
export { ErrorHandler } from './error-handler.js';
export { TimeoutManager } from './timeout.js';
//# sourceMappingURL=index.d.ts.map