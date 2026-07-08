export interface TimeoutConfig {
    defaultTimeout: number;
    methodTimeouts: Record<string, number>;
    maxTimeout: number;
}
export declare class TimeoutManager {
    private readonly config;
    private timeoutCount;
    private activeTimeouts;
    private readonly timeoutLock;
    constructor(config?: Partial<TimeoutConfig>);
    /**
     * Create a timeout promise for a specific method
     */
    createTimeout(method: string): Promise<never>;
    /**
     * Create a timeout promise that can be cleared
     */
    createClearableTimeout(method: string): {
        promise: Promise<never>;
        clear: () => void;
    };
    /**
     * Wrap a promise with timeout
     */
    withTimeout<T>(promise: Promise<T>, method: string): Promise<T>;
    /**
     * Get timeout duration for a specific method
     */
    private getTimeoutForMethod;
    /**
     * Clear all active timeouts
     */
    clearAllTimeouts(): Promise<void>;
    /**
     * Get timeout statistics
     */
    getStats(): {
        totalTimeouts: number;
        activeTimeouts: number;
        config: {
            defaultTimeout: number;
            maxTimeout: number;
            methodTimeoutCount: number;
        };
    };
    /**
     * Update timeout configuration
     */
    updateConfig(newConfig: Partial<TimeoutConfig>): void;
}
//# sourceMappingURL=timeout.d.ts.map