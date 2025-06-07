import { jest } from '@jest/globals';

// Use dynamic import within tests to get a fresh instance after modifications
let metricsModule: typeof import('../src/metrics');

beforeEach(async () => {
  jest.resetModules();
  metricsModule = await import('../src/metrics');
  metricsModule.metrics.reset();
});

afterEach(() => {
  metricsModule.metrics.shutdown();
});

describe('Metrics Collector', () => {
  it('should clean up operations older than timeout', () => {
    const { metrics } = metricsModule;
    const opId = metrics.startOperation('oldOp');
    // Force operation start time to be older than timeout
    (metrics as any).activeOperations.set(opId, Date.now() - 6 * 60 * 1000);

    // Call private cleanup method
    (metrics as any).cleanupStaleOperations();

    expect((metrics as any).activeOperations.size).toBe(0);
    const opMetrics = metrics.getOperationMetrics('oldOp');
    expect(opMetrics?.count).toBe(1);
    expect(opMetrics?.errors).toBe(1);
  });

  it('should keep active operations when cleaning up', () => {
    const { metrics } = metricsModule;
    const oldId = metrics.startOperation('oldOp');
    const activeId = metrics.startOperation('activeOp');
    (metrics as any).activeOperations.set(oldId, Date.now() - 6 * 60 * 1000);

    (metrics as any).cleanupStaleOperations();

    expect((metrics as any).activeOperations.size).toBe(1);
    expect((metrics as any).activeOperations.has(activeId)).toBe(true);
  });

  it('should reset metrics and active operations', () => {
    const { metrics } = metricsModule;
    const id = metrics.startOperation('testOp');
    metrics.endOperation(id);

    expect(Object.keys(metrics.getAllMetrics()).length).toBeGreaterThan(0);

    metrics.reset();
    expect(metrics.getAllMetrics()).toEqual({});
    expect((metrics as any).activeOperations.size).toBe(0);
  });

  it('should allow ending operations after shutdown without throwing', () => {
    const { metrics } = metricsModule;
    const id = metrics.startOperation('testOp');
    metrics.shutdown();
    expect(() => metrics.endOperation(id)).not.toThrow();
  });

  it('should report memory usage metrics', () => {
    const { metrics } = metricsModule;
    const fakeMem = {
      rss: 1000,
      heapTotal: 2000,
      heapUsed: 1500,
      external: 0,
      arrayBuffers: 0,
    } as NodeJS.MemoryUsage;
    const spy = jest.spyOn(process, 'memoryUsage').mockReturnValue(fakeMem);

    const system = metrics.getSystemMetrics();
    expect(system.memoryUsage).toBe(fakeMem);
    spy.mockRestore();
  });
});
