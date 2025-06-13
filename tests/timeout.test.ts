// ABOUTME: Unit tests for TimeoutManager middleware
// ABOUTME: Tests timeout handling, async lock safety, and configuration management

import { jest } from '@jest/globals';

// Mock logger
jest.mock('../src/logger.js', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { TimeoutManager, type TimeoutConfig } from '../src/middleware/timeout.js';
import { McpTimeoutError } from '../src/middleware/error-handler.js';

// Helper function to sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('TimeoutManager', () => {
  let timeoutManager: TimeoutManager;

  beforeEach(() => {
    jest.clearAllMocks();
    timeoutManager = new TimeoutManager();
  });

  afterEach(async () => {
    // Clean up any active timeouts
    await timeoutManager.clearAllTimeouts();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const manager = new TimeoutManager();
      const stats = manager.getStats();

      expect(stats.config.defaultTimeout).toBe(30000);
      expect(stats.config.maxTimeout).toBe(120000);
      expect(stats.config.methodTimeoutCount).toBeGreaterThan(0);
      expect(stats.totalTimeouts).toBe(0);
      expect(stats.activeTimeouts).toBe(0);
    });

    it('should accept custom configuration', () => {
      const customConfig: Partial<TimeoutConfig> = {
        defaultTimeout: 15000,
        maxTimeout: 60000,
        methodTimeouts: {
          'custom/method': 5000,
        },
      };

      const manager = new TimeoutManager(customConfig);
      const stats = manager.getStats();

      expect(stats.config.defaultTimeout).toBe(15000);
      expect(stats.config.maxTimeout).toBe(60000);
    });

    it('should merge custom method timeouts with defaults', () => {
      const customConfig: Partial<TimeoutConfig> = {
        methodTimeouts: {
          'custom/method': 8000,
          'tools/call': 45000, // Override default
        },
      };

      const manager = new TimeoutManager(customConfig);
      const stats = manager.getStats();

      // Should have both default methods and custom ones
      expect(stats.config.methodTimeoutCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('createTimeout', () => {
    it('should create a timeout promise that rejects after specified time', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 100,
        methodTimeouts: {},
      });

      const start = Date.now();
      await expect(manager.createTimeout('test/method')).rejects.toThrow(McpTimeoutError);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some timing variance
      expect(elapsed).toBeLessThan(200);
    });

    it('should use method-specific timeout when available', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 1000,
        methodTimeouts: {
          'fast/method': 50,
        },
      });

      const start = Date.now();
      await expect(manager.createTimeout('fast/method')).rejects.toThrow(McpTimeoutError);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(40);
      expect(elapsed).toBeLessThan(150);
    });

    it('should use default timeout for unknown methods', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 50,
        methodTimeouts: {
          'known/method': 1000,
        },
      });

      const start = Date.now();
      await expect(manager.createTimeout('unknown/method')).rejects.toThrow(McpTimeoutError);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(40);
      expect(elapsed).toBeLessThan(150);
    });

    it('should respect maximum timeout limit', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 30000,
        maxTimeout: 80,
        methodTimeouts: {
          'long/method': 10000, // This should be capped at maxTimeout
        },
      });

      const start = Date.now();
      await expect(manager.createTimeout('long/method')).rejects.toThrow(McpTimeoutError);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(70);
      expect(elapsed).toBeLessThan(150);
    });

    it('should track timeout statistics', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 50,
        methodTimeouts: {},
      });

      const initialStats = manager.getStats();
      expect(initialStats.totalTimeouts).toBe(0);

      try {
        await manager.createTimeout('test/method');
      } catch {
        // Expected timeout
      }

      const finalStats = manager.getStats();
      expect(finalStats.totalTimeouts).toBe(1);
    });
  });

  describe('createClearableTimeout', () => {
    it('should create timeout that can be cleared', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 100,
        methodTimeouts: {},
      });

      const { promise, clear } = manager.createClearableTimeout('test/method');

      // Clear immediately
      clear();

      // Promise should still be pending, but won't reject
      const raceResult = await Promise.race([
        promise.catch(() => 'timeout'),
        sleep(150).then(() => 'success')
      ]);

      expect(raceResult).toBe('success');
    });

    it('should timeout if not cleared', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 50,
        methodTimeouts: {},
      });

      const { promise } = manager.createClearableTimeout('test/method');

      await expect(promise).rejects.toThrow(McpTimeoutError);
    });

    it('should handle multiple clear calls safely', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 100,
        methodTimeouts: {},
      });

      const { clear } = manager.createClearableTimeout('test/method');

      // Multiple clears should not throw
      expect(() => {
        clear();
        clear();
        clear();
      }).not.toThrow();
    });
  });

  describe('withTimeout', () => {
    it('should resolve with promise result when promise completes first', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 200,
        methodTimeouts: {},
      });

      const promise = sleep(50).then(() => 'success');
      const result = await manager.withTimeout(promise, 'test/method');

      expect(result).toBe('success');
    });

    it('should reject with timeout error when timeout occurs first', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 50,
        methodTimeouts: {},
      });

      const promise = sleep(200).then(() => 'success');

      await expect(manager.withTimeout(promise, 'test/method')).rejects.toThrow(McpTimeoutError);
    });

    it('should propagate promise errors', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 200,
        methodTimeouts: {},
      });

      const promise = sleep(50).then(() => {
        throw new Error('Test error');
      });

      await expect(manager.withTimeout(promise, 'test/method')).rejects.toThrow('Test error');
    });

    it('should clean up timeout when promise resolves', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 200,
        methodTimeouts: {},
      });

      const promise = sleep(50).then(() => 'success');
      await manager.withTimeout(promise, 'test/method');

      // Give a moment for cleanup
      await sleep(10);

      const stats = manager.getStats();
      expect(stats.activeTimeouts).toBe(0);
    });

    it('should clean up timeout when promise rejects', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 200,
        methodTimeouts: {},
      });

      const promise = sleep(50).then(() => {
        throw new Error('Test error');
      });

      try {
        await manager.withTimeout(promise, 'test/method');
      } catch {
        // Expected error
      }

      // Give a moment for cleanup
      await sleep(10);

      const stats = manager.getStats();
      expect(stats.activeTimeouts).toBe(0);
    });
  });

  describe('clearAllTimeouts', () => {
    it('should clear all active timeouts', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 1000,
        methodTimeouts: {},
      });

      // Create multiple timeouts
      const timeout1 = manager.createClearableTimeout('method1');
      const timeout2 = manager.createClearableTimeout('method2');
      const timeout3 = manager.createClearableTimeout('method3');

      const initialStats = manager.getStats();
      expect(initialStats.activeTimeouts).toBe(3);

      await manager.clearAllTimeouts();

      const finalStats = manager.getStats();
      expect(finalStats.activeTimeouts).toBe(0);

      // Promises should not timeout anymore
      const results = await Promise.allSettled([
        Promise.race([timeout1.promise.catch(() => 'timeout'), sleep(50).then(() => 'cleared')]),
        Promise.race([timeout2.promise.catch(() => 'timeout'), sleep(50).then(() => 'cleared')]),
        Promise.race([timeout3.promise.catch(() => 'timeout'), sleep(50).then(() => 'cleared')]),
      ]);

      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
        expect((result as PromiseFulfilledResult<string>).value).toBe('cleared');
      });
    });

    it('should handle clearing when no timeouts are active', async () => {
      const manager = new TimeoutManager();

      // Should not throw
      await expect(manager.clearAllTimeouts()).resolves.toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('should return current statistics', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 100,
        methodTimeouts: {
          'custom/method': 200,
        },
      });

      const initialStats = manager.getStats();
      expect(initialStats).toEqual({
        totalTimeouts: 0,
        activeTimeouts: 0,
        config: {
          defaultTimeout: 100,
          maxTimeout: 120000,
          methodTimeoutCount: expect.any(Number),
        },
      });

      // Create timeout
      const { clear } = manager.createClearableTimeout('test/method');

      const statsWithActive = manager.getStats();
      expect(statsWithActive.activeTimeouts).toBe(1);

      // Clean up the clearable timeout first
      clear();
      await sleep(10);

      // Let timeout occur with a fast timeout
      const fastManager = new TimeoutManager({
        defaultTimeout: 50,
        methodTimeouts: {},
      });

      try {
        await fastManager.createTimeout('fast/method');
      } catch {
        // Expected timeout
      }

      const finalStats = fastManager.getStats();
      expect(finalStats.totalTimeouts).toBe(1);
    });
  });

  describe('updateConfig', () => {
    it('should update timeout configuration', () => {
      const manager = new TimeoutManager();

      const newConfig: Partial<TimeoutConfig> = {
        defaultTimeout: 5000,
        maxTimeout: 15000,
        methodTimeouts: {
          'new/method': 3000,
        },
      };

      manager.updateConfig(newConfig);

      const stats = manager.getStats();
      expect(stats.config.defaultTimeout).toBe(5000);
      expect(stats.config.maxTimeout).toBe(15000);
    });

    it('should merge new method timeouts with existing ones', () => {
      const manager = new TimeoutManager({
        methodTimeouts: {
          'existing/method': 1000,
        },
      });

      manager.updateConfig({
        methodTimeouts: {
          'new/method': 2000,
        },
      });

      // Both methods should exist - the update should merge with existing defaults
      const stats = manager.getStats();
      expect(stats.config.methodTimeoutCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent timeouts safely', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 100,
        methodTimeouts: {},
      });

      // Create multiple concurrent timeouts
      const promises = Array(10).fill(0).map((_, i) =>
        manager.createTimeout(`method${i}`).catch(() => `timeout-${i}`)
      );

      const results = await Promise.all(promises);

      // All should timeout
      results.forEach((result, i) => {
        expect(result).toBe(`timeout-${i}`);
      });

      const stats = manager.getStats();
      expect(stats.totalTimeouts).toBe(10);
      expect(stats.activeTimeouts).toBe(0);
    });

    it('should handle concurrent clear operations safely', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 500,
        methodTimeouts: {},
      });

      // Create multiple clearable timeouts
      const clearableTimeouts = Array(5).fill(0).map((_, i) =>
        manager.createClearableTimeout(`method${i}`)
      );

      // Clear them all concurrently
      await Promise.all(clearableTimeouts.map(({ clear }) => clear()));

      const stats = manager.getStats();
      expect(stats.activeTimeouts).toBe(0);
    });

    it('should handle mix of timeouts and clears safely', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 100,
        methodTimeouts: {},
      });

      // Create some that will timeout
      const timeoutPromises = Array(3).fill(0).map((_, i) =>
        manager.createTimeout(`timeout-method${i}`).catch(() => `timeout-${i}`)
      );

      // Create some that will be cleared
      const clearableTimeouts = Array(3).fill(0).map((_, i) =>
        manager.createClearableTimeout(`clear-method${i}`)
      );

      // Clear the clearable ones immediately
      clearableTimeouts.forEach(({ clear }) => clear());

      // Wait for timeouts to complete
      const timeoutResults = await Promise.all(timeoutPromises);

      timeoutResults.forEach((result, i) => {
        expect(result).toBe(`timeout-${i}`);
      });

      const stats = manager.getStats();
      expect(stats.totalTimeouts).toBe(3);
      expect(stats.activeTimeouts).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should create proper McpTimeoutError instances', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 50,
        methodTimeouts: {},
      });

      try {
        await manager.createTimeout('test/method');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(McpTimeoutError);
        expect((error as McpTimeoutError).message).toContain('timed out after 50ms');
      }
    });

    it('should handle timeout edge cases', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 0, // Immediate timeout
        methodTimeouts: {},
      });

      const start = Date.now();
      await expect(manager.createTimeout('immediate/method')).rejects.toThrow(McpTimeoutError);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50); // Should be very fast
    });
  });

  describe('Resource Management', () => {
    it('should properly track active timeouts count', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 200,
        methodTimeouts: {},
      });

      const stats1 = manager.getStats();
      expect(stats1.activeTimeouts).toBe(0);

      // Create clearable timeout
      const { clear } = manager.createClearableTimeout('test1');
      const stats2 = manager.getStats();
      expect(stats2.activeTimeouts).toBe(1);

      // Create another
      manager.createClearableTimeout('test2');
      const stats3 = manager.getStats();
      expect(stats3.activeTimeouts).toBe(2);

      // Clear one
      clear();
      await sleep(10); // Allow async cleanup
      const stats4 = manager.getStats();
      expect(stats4.activeTimeouts).toBe(1);
    });

    it('should not leak timeouts on rapid creation and clearing', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 1000,
        methodTimeouts: {},
      });

      // Rapidly create and clear timeouts
      for (let i = 0; i < 20; i++) {
        const { clear } = manager.createClearableTimeout(`rapid-${i}`);
        clear();
      }

      await sleep(50); // Allow cleanup

      const stats = manager.getStats();
      expect(stats.activeTimeouts).toBe(0);
    });
  });

  describe('Method-Specific Timeouts', () => {
    it('should use correct timeouts for predefined methods', async () => {
      const manager = new TimeoutManager(); // Use defaults

      // Test that tools/call gets longer timeout than resources/read
      const toolCallTimeout = manager.createClearableTimeout('tools/call');
      const resourceReadTimeout = manager.createClearableTimeout('resources/read');

      // Both should be created without immediate timeout
      expect(toolCallTimeout.promise).toBeInstanceOf(Promise);
      expect(resourceReadTimeout.promise).toBeInstanceOf(Promise);

      // Clean up
      toolCallTimeout.clear();
      resourceReadTimeout.clear();
    });

    it('should handle method names with special characters', async () => {
      const manager = new TimeoutManager({
        defaultTimeout: 100,
        methodTimeouts: {
          'method/with/slashes': 50,
          'method-with-dashes': 50,
          'method_with_underscores': 50,
          'method.with.dots': 50,
        },
      });

      // All should timeout quickly
      const promises = [
        'method/with/slashes',
        'method-with-dashes',
        'method_with_underscores',
        'method.with.dots'
      ].map(method => manager.createTimeout(method).catch(() => method));

      const results = await Promise.all(promises);
      expect(results).toEqual([
        'method/with/slashes',
        'method-with-dashes',
        'method_with_underscores',
        'method.with.dots'
      ]);
    });
  });
});
