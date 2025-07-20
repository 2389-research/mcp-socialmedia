// ABOUTME: Unit tests for metrics collection system
// ABOUTME: Tests operation tracking, system metrics, and performance monitoring

import { jest } from '@jest/globals';

import { MetricsCollector, type OperationMetrics, metrics, withMetrics } from '../src/metrics.js';

// Helper function to sleep
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('MetricsCollector', () => {
  let metricsCollector: MetricsCollector;

  beforeEach(() => {
    // Get fresh instance and reset it
    metricsCollector = MetricsCollector.getInstance();
    metricsCollector.reset();
  });

  afterEach(() => {
    // Clean up
    metricsCollector.reset();
  });

  afterAll(() => {
    // Final cleanup
    metricsCollector.shutdown();
  });

  describe('singleton behavior', () => {
    it('should return the same instance', () => {
      const instance1 = MetricsCollector.getInstance();
      const instance2 = MetricsCollector.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBe(metricsCollector);
    });

    it('should maintain state across getInstance calls', () => {
      const instance1 = MetricsCollector.getInstance();
      instance1.incrementSessionCount();

      const instance2 = MetricsCollector.getInstance();
      expect(instance2.getSessionCount()).toBe(1);
    });
  });

  describe('operation tracking', () => {
    it('should start and end operations successfully', () => {
      const operationId = metricsCollector.startOperation('test-operation');

      expect(operationId).toMatch(/^test-operation_\d+_0\.\d+$/);

      // End the operation
      metricsCollector.endOperation(operationId, true);

      const operationMetrics = metricsCollector.getOperationMetrics('test-operation');
      expect(operationMetrics).toBeDefined();
      expect(operationMetrics?.count).toBe(1);
      expect(operationMetrics?.errors).toBe(0);
    });

    it('should track operation duration', async () => {
      const operationId = metricsCollector.startOperation('timing-test');

      // Wait a bit
      await sleep(50);

      metricsCollector.endOperation(operationId, true);

      const operationMetrics = metricsCollector.getOperationMetrics('timing-test');
      expect(operationMetrics?.lastDuration).toBeGreaterThanOrEqual(40);
      expect(operationMetrics?.lastDuration).toBeLessThan(200);
      expect(operationMetrics?.minDuration).toBe(operationMetrics?.lastDuration);
      expect(operationMetrics?.maxDuration).toBe(operationMetrics?.lastDuration);
      expect(operationMetrics?.averageDuration).toBe(operationMetrics?.lastDuration);
    });

    it('should track multiple operations of same type', async () => {
      // First operation
      const op1 = metricsCollector.startOperation('multi-test');
      await sleep(30);
      metricsCollector.endOperation(op1, true);

      // Second operation
      const op2 = metricsCollector.startOperation('multi-test');
      await sleep(70);
      metricsCollector.endOperation(op2, true);

      const metrics = metricsCollector.getOperationMetrics('multi-test');
      expect(metrics?.count).toBe(2);
      expect(metrics?.minDuration).toBeLessThan(metrics?.maxDuration);
      expect(metrics?.averageDuration).toBeGreaterThan(0);
      expect(metrics?.totalDuration).toBe(metrics?.minDuration + metrics?.maxDuration);
    });

    it('should track operation errors', () => {
      const operationId = metricsCollector.startOperation('error-test');
      metricsCollector.endOperation(operationId, false);

      const operationMetrics = metricsCollector.getOperationMetrics('error-test');
      expect(operationMetrics?.count).toBe(1);
      expect(operationMetrics?.errors).toBe(1);
    });

    it('should handle non-existent operation ID gracefully', () => {
      expect(() => {
        metricsCollector.endOperation('non-existent-id', true);
      }).not.toThrow();

      // Should not create metrics for non-existent operation
      expect(metricsCollector.getOperationMetrics('non-existent')).toBeUndefined();
    });

    it('should track concurrent operations', async () => {
      const ops = Array(5)
        .fill(0)
        .map((_, i) => metricsCollector.startOperation(`concurrent-test-${i}`));

      // End them all after different delays
      await Promise.all(
        ops.map(async (opId, i) => {
          await sleep(20 + i * 10);
          metricsCollector.endOperation(opId, true);
        }),
      );

      // Each should have its own metrics
      for (let i = 0; i < 5; i++) {
        const metrics = metricsCollector.getOperationMetrics(`concurrent-test-${i}`);
        expect(metrics?.count).toBe(1);
      }
    });
  });

  describe('session management', () => {
    it('should track session count', () => {
      expect(metricsCollector.getSessionCount()).toBe(0);

      metricsCollector.incrementSessionCount();
      expect(metricsCollector.getSessionCount()).toBe(1);

      metricsCollector.incrementSessionCount();
      expect(metricsCollector.getSessionCount()).toBe(2);

      metricsCollector.decrementSessionCount();
      expect(metricsCollector.getSessionCount()).toBe(1);
    });

    it('should not allow negative session count', () => {
      expect(metricsCollector.getSessionCount()).toBe(0);

      metricsCollector.decrementSessionCount();
      expect(metricsCollector.getSessionCount()).toBe(0);

      metricsCollector.decrementSessionCount();
      expect(metricsCollector.getSessionCount()).toBe(0);
    });

    it('should track concurrent session changes', () => {
      // Simulate rapid session creation/destruction
      for (let i = 0; i < 10; i++) {
        metricsCollector.incrementSessionCount();
      }
      expect(metricsCollector.getSessionCount()).toBe(10);

      for (let i = 0; i < 7; i++) {
        metricsCollector.decrementSessionCount();
      }
      expect(metricsCollector.getSessionCount()).toBe(3);
    });
  });

  describe('system metrics', () => {
    it('should provide system metrics', () => {
      const systemMetrics = metricsCollector.getSystemMetrics();

      expect(systemMetrics).toEqual({
        uptime: expect.any(Number),
        memoryUsage: expect.objectContaining({
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number),
          external: expect.any(Number),
          arrayBuffers: expect.any(Number),
        }),
        sessionCount: 0,
        activeOperations: 0,
      });

      expect(systemMetrics.uptime).toBeGreaterThanOrEqual(0);
      expect(systemMetrics.memoryUsage.rss).toBeGreaterThan(0);
    });

    it('should update active operations count', () => {
      const initialMetrics = metricsCollector.getSystemMetrics();
      expect(initialMetrics.activeOperations).toBe(0);

      const op1 = metricsCollector.startOperation('active-test-1');
      const op2 = metricsCollector.startOperation('active-test-2');

      const activeMetrics = metricsCollector.getSystemMetrics();
      expect(activeMetrics.activeOperations).toBe(2);

      metricsCollector.endOperation(op1, true);

      const partiallyActiveMetrics = metricsCollector.getSystemMetrics();
      expect(partiallyActiveMetrics.activeOperations).toBe(1);

      metricsCollector.endOperation(op2, true);

      const finalMetrics = metricsCollector.getSystemMetrics();
      expect(finalMetrics.activeOperations).toBe(0);
    });

    it('should track uptime progression', async () => {
      const metrics1 = metricsCollector.getSystemMetrics();

      await sleep(100);

      const metrics2 = metricsCollector.getSystemMetrics();
      expect(metrics2.uptime).toBeGreaterThanOrEqual(metrics1.uptime);
    });
  });

  describe('getAllMetrics', () => {
    it('should return empty object when no operations tracked', () => {
      const allMetrics = metricsCollector.getAllMetrics();
      expect(allMetrics).toEqual({});
    });

    it('should return all tracked operation metrics', () => {
      // Track some operations
      const op1 = metricsCollector.startOperation('op1');
      const op2 = metricsCollector.startOperation('op2');

      metricsCollector.endOperation(op1, true);
      metricsCollector.endOperation(op2, false);

      const allMetrics = metricsCollector.getAllMetrics();

      expect(Object.keys(allMetrics)).toEqual(['op1', 'op2']);
      expect(allMetrics.op1.count).toBe(1);
      expect(allMetrics.op1.errors).toBe(0);
      expect(allMetrics.op2.count).toBe(1);
      expect(allMetrics.op2.errors).toBe(1);
    });

    it('should return deep copies of metrics', () => {
      const op = metricsCollector.startOperation('mutation-test');
      metricsCollector.endOperation(op, true);

      const allMetrics = metricsCollector.getAllMetrics();
      const originalCount = allMetrics['mutation-test'].count;

      // Mutate the returned object
      allMetrics['mutation-test'].count = 999;

      // Original should be unchanged
      const freshMetrics = metricsCollector.getAllMetrics();
      expect(freshMetrics['mutation-test'].count).toBe(originalCount);
    });
  });

  describe('getSummary', () => {
    it('should generate readable summary', () => {
      // Add some sample data
      metricsCollector.incrementSessionCount();
      metricsCollector.incrementSessionCount();

      const op1 = metricsCollector.startOperation('summary-test');
      metricsCollector.endOperation(op1, true);

      const summary = metricsCollector.getSummary();

      expect(summary).toContain('=== System Metrics ===');
      expect(summary).toContain('=== Operation Metrics ===');
      expect(summary).toContain('Active Sessions: 2');
      expect(summary).toContain('summary-test:');
      expect(summary).toContain('Count: 1');
      expect(summary).toContain('Error Rate:');
    });

    it('should handle empty metrics gracefully', () => {
      const summary = metricsCollector.getSummary();

      expect(summary).toContain('=== System Metrics ===');
      expect(summary).toContain('=== Operation Metrics ===');
      expect(summary).toContain('Active Sessions: 0');
    });
  });

  describe('reset functionality', () => {
    it('should clear all metrics when reset', () => {
      // Add some data
      metricsCollector.incrementSessionCount();
      const op = metricsCollector.startOperation('reset-test');
      metricsCollector.endOperation(op, true);

      expect(metricsCollector.getSessionCount()).toBe(1);
      expect(metricsCollector.getOperationMetrics('reset-test')).toBeDefined();

      // Reset
      metricsCollector.reset();

      expect(metricsCollector.getSessionCount()).toBe(0);
      expect(metricsCollector.getOperationMetrics('reset-test')).toBeUndefined();
      expect(metricsCollector.getAllMetrics()).toEqual({});
    });

    it('should clear active operations when reset', () => {
      const op1 = metricsCollector.startOperation('active-reset-test');
      metricsCollector.startOperation('active-reset-test-2');

      expect(metricsCollector.getSystemMetrics().activeOperations).toBe(2);

      metricsCollector.reset();

      expect(metricsCollector.getSystemMetrics().activeOperations).toBe(0);

      // Ending the operation after reset should not create metrics
      metricsCollector.endOperation(op1, true);
      expect(metricsCollector.getOperationMetrics('active-reset-test')).toBeUndefined();
    });
  });

  describe('stale operation cleanup', () => {
    it('should clean up stale operations after timeout', async () => {
      // Create a collector with very short timeout for testing
      const testCollector = new (class extends MetricsCollector {
        // Override the cleanup timeout for testing
        public testCleanupStaleOperations() {
          // Use reflection to access private method
          (this as unknown as { OPERATION_TIMEOUT: number }).OPERATION_TIMEOUT = 50; // Very short timeout
          (this as unknown as { cleanupStaleOperations: () => void }).cleanupStaleOperations();
        }
      })();

      testCollector.reset();

      const operationId = testCollector.startOperation('stale-test');

      // Wait longer than timeout
      await sleep(100);

      // Trigger cleanup manually
      testCollector.testCleanupStaleOperations();

      // Operation should be cleaned up and marked as error
      const metrics = testCollector.getOperationMetrics('stale-test');
      expect(metrics?.count).toBe(1);
      expect(metrics?.errors).toBe(1);

      // Active operations should be cleared
      expect(testCollector.getSystemMetrics().activeOperations).toBe(0);

      // Ending the already cleaned operation should not affect metrics
      testCollector.endOperation(operationId, true);
      expect(metrics?.count).toBe(1); // Should still be 1

      testCollector.shutdown();
    }, 10000);
  });

  describe('error cases', () => {
    it('should handle malformed operation IDs', () => {
      expect(() => {
        metricsCollector.endOperation('malformed-id-without-underscores', true);
      }).not.toThrow();

      expect(() => {
        metricsCollector.endOperation('_', true);
      }).not.toThrow();

      expect(() => {
        metricsCollector.endOperation('', true);
      }).not.toThrow();
    });

    it('should handle duplicate operation ending', () => {
      const operationId = metricsCollector.startOperation('duplicate-end-test');

      metricsCollector.endOperation(operationId, true);

      // Ending again should not throw or affect metrics
      expect(() => {
        metricsCollector.endOperation(operationId, true);
      }).not.toThrow();

      const metrics = metricsCollector.getOperationMetrics('duplicate-end-test');
      expect(metrics?.count).toBe(1);
    });
  });
});

describe('withMetrics helper', () => {
  beforeEach(() => {
    metrics.reset();
  });

  afterEach(() => {
    metrics.reset();
  });

  afterAll(() => {
    metrics.shutdown();
  });

  it('should track successful async operations', async () => {
    const result = await withMetrics('helper-test', async () => {
      await sleep(50);
      return 'success';
    });

    expect(result).toBe('success');

    const operationMetrics = metrics.getOperationMetrics('helper-test');
    expect(operationMetrics?.count).toBe(1);
    expect(operationMetrics?.errors).toBe(0);
    expect(operationMetrics?.lastDuration).toBeGreaterThanOrEqual(40);
  });

  it('should track failed async operations', async () => {
    await expect(
      withMetrics('helper-error-test', async () => {
        await sleep(30);
        throw new Error('Test error');
      }),
    ).rejects.toThrow('Test error');

    const operationMetrics = metrics.getOperationMetrics('helper-error-test');
    expect(operationMetrics?.count).toBe(1);
    expect(operationMetrics?.errors).toBe(1);
    expect(operationMetrics?.lastDuration).toBeGreaterThanOrEqual(20);
  });

  it('should handle promise rejection correctly', async () => {
    await expect(
      withMetrics('helper-rejection-test', async () => {
        return Promise.reject('Rejection reason');
      }),
    ).rejects.toBe('Rejection reason');

    const operationMetrics = metrics.getOperationMetrics('helper-rejection-test');
    expect(operationMetrics?.count).toBe(1);
    expect(operationMetrics?.errors).toBe(1);
  });

  it('should track multiple concurrent operations', async () => {
    const promises = Array(3)
      .fill(0)
      .map(async (_, i) => {
        return withMetrics(`concurrent-helper-${i}`, async () => {
          await sleep(50 + i * 20);
          return `result-${i}`;
        });
      });

    const results = await Promise.all(promises);

    expect(results).toEqual(['result-0', 'result-1', 'result-2']);

    // Each operation should have its own metrics
    for (let i = 0; i < 3; i++) {
      const operationMetrics = metrics.getOperationMetrics(`concurrent-helper-${i}`);
      expect(operationMetrics?.count).toBe(1);
      expect(operationMetrics?.errors).toBe(0);
    }
  });

  it('should handle immediately resolved promises', async () => {
    const result = await withMetrics('immediate-test', async () => {
      return 'immediate';
    });

    expect(result).toBe('immediate');

    const operationMetrics = metrics.getOperationMetrics('immediate-test');
    expect(operationMetrics?.count).toBe(1);
    expect(operationMetrics?.lastDuration).toBeGreaterThanOrEqual(0);
    expect(operationMetrics?.lastDuration).toBeLessThan(50);
  });

  it('should handle non-async functions', async () => {
    const result = await withMetrics('sync-test', async () => {
      // Sync operation wrapped in async
      return 2 + 2;
    });

    expect(result).toBe(4);

    const operationMetrics = metrics.getOperationMetrics('sync-test');
    expect(operationMetrics?.count).toBe(1);
    expect(operationMetrics?.errors).toBe(0);
  });
});

describe('exported metrics instance', () => {
  afterEach(() => {
    metrics.reset();
  });

  afterAll(() => {
    metrics.shutdown();
  });

  it('should be the same as MetricsCollector.getInstance()', () => {
    expect(metrics).toBe(MetricsCollector.getInstance());
  });

  it('should maintain state across imports', () => {
    metrics.incrementSessionCount();
    expect(MetricsCollector.getInstance().getSessionCount()).toBe(1);
  });
});

describe('OperationMetrics interface', () => {
  it('should have correct structure when created', () => {
    const metricsCollector = MetricsCollector.getInstance();
    metricsCollector.reset();

    const operationId = metricsCollector.startOperation('structure-test');
    metricsCollector.endOperation(operationId, true);

    const operationMetrics = metricsCollector.getOperationMetrics('structure-test');

    expect(operationMetrics).toEqual<OperationMetrics>({
      count: expect.any(Number),
      totalDuration: expect.any(Number),
      minDuration: expect.any(Number),
      maxDuration: expect.any(Number),
      averageDuration: expect.any(Number),
      lastDuration: expect.any(Number),
      errors: expect.any(Number),
    });

    expect(operationMetrics?.count).toBe(1);
    expect(operationMetrics?.errors).toBe(0);
    expect(operationMetrics?.totalDuration).toBe(operationMetrics?.lastDuration);
    expect(operationMetrics?.minDuration).toBe(operationMetrics?.lastDuration);
    expect(operationMetrics?.maxDuration).toBe(operationMetrics?.lastDuration);
    expect(operationMetrics?.averageDuration).toBe(operationMetrics?.lastDuration);
  });
});
