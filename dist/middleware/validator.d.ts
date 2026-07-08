export declare class RequestValidator {
    private validationCount;
    private validationErrors;
    /**
     * Validate an MCP request
     */
    validateRequest(request: any): Promise<void>;
    /**
     * Validate an MCP response
     */
    validateResponse(response: any, method: string): Promise<void>;
    /**
     * Perform additional custom validations
     */
    private performCustomValidations;
    /**
     * Get validation statistics
     */
    getStats(): {
        totalValidations: number;
        validationErrors: number;
        successRate: number;
    };
}
//# sourceMappingURL=validator.d.ts.map