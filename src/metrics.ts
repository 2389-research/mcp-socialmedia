// ABOUTME: Basic performance monitoring and metrics collection
// ABOUTME: Tracks operation timings, memory usage, and system health

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

export class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics: Map<string, OperationMetrics>;
  private startTime: number;
  private sessionCount: number;
  private activeOperations: Map<string, number>;

  private constructor() {
    this.metrics = new Map();
    this.startTime = Date.now();
    this.sessionCount = 0;
    this.activeOperations = new Map();
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  // Start tracking an operation
  startOperation(operationName: string): string {
    const operationId = `${operationName}_${Date.now()}_${Math.random()}`;
    this.activeOperations.set(operationId, Date.now());
    return operationId;
  }

  // End tracking an operation
  endOperation(operationId: string, success: boolean = true): void {
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

  // Record an operation metric
  private recordOperation(name: string, duration: number, success: boolean): void {
    let metrics = this.metrics.get(name);
    if (!metrics) {
      metrics = {
        count: 0,
        totalDuration: 0,
        minDuration: Infinity,
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
  incrementSessionCount(): void {
    this.sessionCount++;
  }

  decrementSessionCount(): void {
    this.sessionCount = Math.max(0, this.sessionCount - 1);
  }

  getSessionCount(): number {
    return this.sessionCount;
  }

  // Get metrics for a specific operation
  getOperationMetrics(operationName: string): OperationMetrics | undefined {
    return this.metrics.get(operationName);
  }

  // Get all metrics
  getAllMetrics(): Record<string, OperationMetrics> {
    const result: Record<string, OperationMetrics> = {};
    this.metrics.forEach((value, key) => {
      result[key] = { ...value };
    });
    return result;
  }

  // Get system metrics
  getSystemMetrics(): {
    uptime: number;
    memoryUsage: ReturnType<typeof process.memoryUsage>;
    sessionCount: number;
    activeOperations: number;
  } {
    return {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      memoryUsage: process.memoryUsage(),
      sessionCount: this.sessionCount,
      activeOperations: this.activeOperations.size,
    };
  }

  // Get formatted summary
  getSummary(): string {
    const system = this.getSystemMetrics();
    const operations = this.getAllMetrics();

    let summary = `=== System Metrics ===\n`;
    summary += `Uptime: ${system.uptime}s\n`;
    summary += `Memory (RSS): ${Math.round(system.memoryUsage.rss / 1024 / 1024)}MB\n`;
    summary += `Memory (Heap Used): ${Math.round(system.memoryUsage.heapUsed / 1024 / 1024)}MB\n`;
    summary += `Active Sessions: ${system.sessionCount}\n`;
    summary += `Active Operations: ${system.activeOperations}\n\n`;

    summary += `=== Operation Metrics ===\n`;
    Object.entries(operations).forEach(([name, metrics]) => {
      summary += `${name}:\n`;
      summary += `  Count: ${metrics.count}\n`;
      summary += `  Avg Duration: ${Math.round(metrics.averageDuration)}ms\n`;
      summary += `  Min Duration: ${Math.round(metrics.minDuration)}ms\n`;
      summary += `  Max Duration: ${Math.round(metrics.maxDuration)}ms\n`;
      summary += `  Error Rate: ${((metrics.errors / metrics.count) * 100).toFixed(2)}%\n`;
    });

    return summary;
  }

  // Reset all metrics (useful for testing)
  reset(): void {
    this.metrics.clear();
    this.activeOperations.clear();
    this.sessionCount = 0;
  }
}

// Export singleton instance
export const metrics = MetricsCollector.getInstance();

// Helper function for timing async operations
export async function withMetrics<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const operationId = metrics.startOperation(operationName);
  try {
    const result = await operation();
    metrics.endOperation(operationId, true);
    return result;
  } catch (error) {
    metrics.endOperation(operationId, false);
    throw error;
  }
}
