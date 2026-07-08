export interface Metric {
    name: string;
    value: number;
    timestamp: Date;
    tags?: Record<string, string>;
}
export interface OperationMetrics {
    count: number;
    totalDuration: number;
    minDuration: number;
    maxDuration: number;
    averageDuration: number;
    lastDuration: number;
    errors: number;
}
export declare class MetricsCollector {
    private static instance;
    private metrics;
    private startTime;
    private sessionCount;
    private activeOperations;
    private cleanupInterval;
    private readonly OPERATION_TIMEOUT;
    private constructor();
    static getInstance(): MetricsCollector;
    startOperation(operationName: string): string;
    endOperation(operationId: string, success?: boolean): void;
    private cleanupStaleOperations;
    private recordOperation;
    incrementSessionCount(): void;
    decrementSessionCount(): void;
    getSessionCount(): number;
    getOperationMetrics(operationName: string): OperationMetrics | undefined;
    getAllMetrics(): Record<string, OperationMetrics>;
    getSystemMetrics(): {
        uptime: number;
        memoryUsage: ReturnType<typeof process.memoryUsage>;
        sessionCount: number;
        activeOperations: number;
    };
    getSummary(): string;
    reset(): void;
    shutdown(): void;
}
export declare const metrics: MetricsCollector;
export declare function withMetrics<T>(operationName: string, operation: () => Promise<T>): Promise<T>;
//# sourceMappingURL=metrics.d.ts.map