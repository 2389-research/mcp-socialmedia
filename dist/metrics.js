// ABOUTME: Basic performance monitoring and metrics collection
// ABOUTME: Tracks operation timings, memory usage, and system health
export class MetricsCollector {
    static instance;
    metrics;
    startTime;
    sessionCount;
    activeOperations;
    cleanupInterval = null;
    OPERATION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    constructor() {
        this.metrics = new Map();
        this.startTime = Date.now();
        this.sessionCount = 0;
        this.activeOperations = new Map();
        // Set up periodic cleanup of stale operations
        this.cleanupInterval = setInterval(() => this.cleanupStaleOperations(), 60000); // Every minute
        // Allow process to exit even if interval is active (for tests)
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }
    static getInstance() {
        if (!MetricsCollector.instance) {
            MetricsCollector.instance = new MetricsCollector();
        }
        return MetricsCollector.instance;
    }
    // Start tracking an operation
    startOperation(operationName) {
        const operationId = `${operationName}_${Date.now()}_${Math.random()}`;
        this.activeOperations.set(operationId, Date.now());
        return operationId;
    }
    // End tracking an operation
    endOperation(operationId, success = true) {
        const startTime = this.activeOperations.get(operationId);
        if (!startTime) {
            return;
        }
        const duration = Date.now() - startTime;
        this.activeOperations.delete(operationId);
        // Extract operation name from ID
        const operationName = operationId.split('_')[0];
        this.recordOperation(operationName, duration, success);
    }
    // Cleanup stale operations that have been running too long
    cleanupStaleOperations() {
        const now = Date.now();
        const staleOperations = [];
        for (const [id, startTime] of this.activeOperations.entries()) {
            if (now - startTime > this.OPERATION_TIMEOUT) {
                staleOperations.push(id);
            }
        }
        // Remove stale operations and record them as timed out
        for (const id of staleOperations) {
            this.activeOperations.delete(id);
            const operationName = id.split('_')[0];
            this.recordOperation(operationName, this.OPERATION_TIMEOUT, false, 'timeout');
        }
    }
    // Record an operation metric
    recordOperation(name, duration, success, _reason) {
        let metrics = this.metrics.get(name);
        if (!metrics) {
            metrics = {
                count: 0,
                totalDuration: 0,
                minDuration: Number.POSITIVE_INFINITY,
                maxDuration: 0,
                averageDuration: 0,
                lastDuration: 0,
                errors: 0,
            };
            this.metrics.set(name, metrics);
        }
        metrics.count++;
        metrics.totalDuration += duration;
        metrics.minDuration = Math.min(metrics.minDuration, duration);
        metrics.maxDuration = Math.max(metrics.maxDuration, duration);
        metrics.averageDuration = metrics.totalDuration / metrics.count;
        metrics.lastDuration = duration;
        if (!success) {
            metrics.errors++;
        }
    }
    // Session management metrics
    incrementSessionCount() {
        this.sessionCount++;
    }
    decrementSessionCount() {
        this.sessionCount = Math.max(0, this.sessionCount - 1);
    }
    getSessionCount() {
        return this.sessionCount;
    }
    // Get metrics for a specific operation
    getOperationMetrics(operationName) {
        return this.metrics.get(operationName);
    }
    // Get all metrics
    getAllMetrics() {
        const result = {};
        this.metrics.forEach((value, key) => {
            result[key] = { ...value };
        });
        return result;
    }
    // Get system metrics
    getSystemMetrics() {
        return {
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
            memoryUsage: process.memoryUsage(),
            sessionCount: this.sessionCount,
            activeOperations: this.activeOperations.size,
        };
    }
    // Get formatted summary
    getSummary() {
        const system = this.getSystemMetrics();
        const operations = this.getAllMetrics();
        let summary = '=== System Metrics ===\n';
        summary += `Uptime: ${system.uptime}s\n`;
        summary += `Memory (RSS): ${Math.round(system.memoryUsage.rss / 1024 / 1024)}MB\n`;
        summary += `Memory (Heap Used): ${Math.round(system.memoryUsage.heapUsed / 1024 / 1024)}MB\n`;
        summary += `Active Sessions: ${system.sessionCount}\n`;
        summary += `Active Operations: ${system.activeOperations}\n\n`;
        summary += '=== Operation Metrics ===\n';
        for (const [name, metrics] of Object.entries(operations)) {
            summary += `${name}:\n`;
            summary += `  Count: ${metrics.count}\n`;
            summary += `  Avg Duration: ${Math.round(metrics.averageDuration)}ms\n`;
            summary += `  Min Duration: ${Math.round(metrics.minDuration)}ms\n`;
            summary += `  Max Duration: ${Math.round(metrics.maxDuration)}ms\n`;
            summary += `  Error Rate: ${((metrics.errors / metrics.count) * 100).toFixed(2)}%\n`;
        }
        return summary;
    }
    // Reset all metrics (useful for testing)
    reset() {
        this.metrics.clear();
        this.activeOperations.clear();
        this.sessionCount = 0;
        // Clear the cleanup interval when resetting
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = setInterval(() => this.cleanupStaleOperations(), 60000);
            // Allow process to exit even if interval is active (for tests)
            if (this.cleanupInterval.unref) {
                this.cleanupInterval.unref();
            }
        }
    }
    // Shutdown the metrics collector (for cleanup)
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}
// Export singleton instance
export const metrics = MetricsCollector.getInstance();
// Helper function for timing async operations
export async function withMetrics(operationName, operation) {
    const operationId = metrics.startOperation(operationName);
    try {
        const result = await operation();
        metrics.endOperation(operationId, true);
        return result;
    }
    catch (error) {
        metrics.endOperation(operationId, false);
        throw error;
    }
}
//# sourceMappingURL=metrics.js.map