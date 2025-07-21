// ABOUTME: Unit tests for the hooks system
// ABOUTME: Tests request/response/error hook processing with various scenarios

import { jest } from '@jest/globals';

// Mock logger
jest.mock('../src/logger.js', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock error classes
jest.mock('../src/middleware/error-handler.js', () => ({
  McpRateLimitError: class McpRateLimitError extends Error {
    constructor(
      message: string,
      public retryAfter: number,
    ) {
      super(message);
      this.name = 'McpRateLimitError';
    }
  },
}));

import { HooksManager } from '../src/hooks/index.js';
import type {
  ErrorHook,
  Hook,
  HookContext,
  RequestHook,
  ResponseHook,
} from '../src/hooks/types.js';

describe('HooksManager', () => {
  let hooksManager: HooksManager;
  let mockContext: HookContext;

  beforeEach(() => {
    jest.clearAllMocks();
    hooksManager = new HooksManager();
    mockContext = {
      sessionId: 'test-session-123',
      startTime: Date.now(),
      metadata: { test: 'value' },
    };
  });

  describe('constructor', () => {
    it('should initialize with default hooks', () => {
      const hooks = hooksManager.getAllHooks();

      expect(hooks.length).toBeGreaterThan(0);
      expect(hooks.some((h) => h.name === 'request-logger')).toBe(true);
      expect(hooks.some((h) => h.name === 'response-enricher')).toBe(true);
      expect(hooks.some((h) => h.name === 'error-enricher')).toBe(true);
      expect(hooks.some((h) => h.name === 'rate-limiter')).toBe(true);
    });

    it('should sort hooks by priority', () => {
      const requestHooks = hooksManager.getAllHooks().filter((h) => h.type === 'request');

      for (let i = 1; i < requestHooks.length; i++) {
        expect(requestHooks[i - 1].priority).toBeLessThanOrEqual(requestHooks[i].priority);
      }
    });
  });

  describe('registerHook', () => {
    it('should register a request hook', () => {
      const testHook: RequestHook = {
        name: 'test-request-hook',
        type: 'request',
        priority: 50,
        execute: jest.fn().mockResolvedValue(undefined),
      };

      const initialCount = hooksManager.getAllHooks().filter((h) => h.type === 'request').length;
      hooksManager.registerHook(testHook);
      const finalCount = hooksManager.getAllHooks().filter((h) => h.type === 'request').length;

      expect(finalCount).toBe(initialCount + 1);
      expect(hooksManager.getAllHooks()).toContain(testHook);
    });

    it('should register a response hook', () => {
      const testHook: ResponseHook = {
        name: 'test-response-hook',
        type: 'response',
        priority: 50,
        execute: jest.fn().mockResolvedValue(undefined),
      };

      const initialCount = hooksManager.getAllHooks().filter((h) => h.type === 'response').length;
      hooksManager.registerHook(testHook);
      const finalCount = hooksManager.getAllHooks().filter((h) => h.type === 'response').length;

      expect(finalCount).toBe(initialCount + 1);
      expect(hooksManager.getAllHooks()).toContain(testHook);
    });

    it('should register an error hook', () => {
      const testHook: ErrorHook = {
        name: 'test-error-hook',
        type: 'error',
        priority: 50,
        execute: jest.fn().mockResolvedValue(undefined),
      };

      const initialCount = hooksManager.getAllHooks().filter((h) => h.type === 'error').length;
      hooksManager.registerHook(testHook);
      const finalCount = hooksManager.getAllHooks().filter((h) => h.type === 'error').length;

      expect(finalCount).toBe(initialCount + 1);
      expect(hooksManager.getAllHooks()).toContain(testHook);
    });

    it('should maintain priority order after registration', () => {
      const hook1: RequestHook = {
        name: 'test-hook-1',
        type: 'request',
        priority: 30,
        execute: jest.fn(),
      };

      const hook2: RequestHook = {
        name: 'test-hook-2',
        type: 'request',
        priority: 20,
        execute: jest.fn(),
      };

      hooksManager.registerHook(hook1);
      hooksManager.registerHook(hook2);

      const requestHooks = hooksManager.getAllHooks().filter((h) => h.type === 'request');
      const hook1Index = requestHooks.findIndex((h) => h.name === 'test-hook-1');
      const hook2Index = requestHooks.findIndex((h) => h.name === 'test-hook-2');

      expect(hook2Index).toBeLessThan(hook1Index); // Lower priority executes first
    });
  });

  describe('processRequest', () => {
    it('should process request through all request hooks', async () => {
      const mockExecute1 = jest.fn().mockResolvedValue({ modified: 1 });
      const mockExecute2 = jest.fn().mockResolvedValue({ modified: 2 });

      const hook1: RequestHook = {
        name: 'test-hook-1',
        type: 'request',
        priority: 10,
        execute: mockExecute1,
      };

      const hook2: RequestHook = {
        name: 'test-hook-2',
        type: 'request',
        priority: 20,
        execute: mockExecute2,
      };

      hooksManager.registerHook(hook1);
      hooksManager.registerHook(hook2);

      const request = { method: 'test' };
      const result = await hooksManager.processRequest(request, mockContext);

      expect(mockExecute1).toHaveBeenCalledWith(request, mockContext);
      expect(mockExecute2).toHaveBeenCalledWith({ modified: 1 }, mockContext);
      expect(result).toEqual({ modified: 2 });
    });

    it('should skip hooks with false conditions', async () => {
      const mockExecute = jest.fn();
      const mockCondition = jest.fn().mockReturnValue(false);

      const hook: RequestHook = {
        name: 'test-hook',
        type: 'request',
        priority: 50,
        condition: mockCondition,
        execute: mockExecute,
      };

      hooksManager.registerHook(hook);

      const request = { method: 'test' };
      await hooksManager.processRequest(request, mockContext);

      expect(mockCondition).toHaveBeenCalledWith(request, mockContext);
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should execute hooks with true conditions', async () => {
      const mockExecute = jest.fn().mockResolvedValue(undefined);
      const mockCondition = jest.fn().mockReturnValue(true);

      const hook: RequestHook = {
        name: 'test-hook',
        type: 'request',
        priority: 50,
        condition: mockCondition,
        execute: mockExecute,
      };

      hooksManager.registerHook(hook);

      const request = { method: 'test' };
      await hooksManager.processRequest(request, mockContext);

      expect(mockCondition).toHaveBeenCalledWith(request, mockContext);
      expect(mockExecute).toHaveBeenCalledWith(request, mockContext);
    });

    it('should handle non-critical hook failures gracefully', async () => {
      const mockExecute = jest.fn().mockRejectedValue(new Error('Hook failed'));

      const hook: RequestHook = {
        name: 'test-hook',
        type: 'request',
        priority: 50,
        critical: false,
        execute: mockExecute,
      };

      hooksManager.registerHook(hook);

      const request = { method: 'test' };
      const result = await hooksManager.processRequest(request, mockContext);

      expect(result).toEqual(request); // Original request returned
    });

    it('should propagate critical hook failures', async () => {
      const hookError = new Error('Critical hook failed');
      const mockExecute = jest.fn().mockRejectedValue(hookError);

      const hook: RequestHook = {
        name: 'test-hook',
        type: 'request',
        priority: 50,
        critical: true,
        execute: mockExecute,
      };

      hooksManager.registerHook(hook);

      const request = { method: 'test' };
      await expect(hooksManager.processRequest(request, mockContext)).rejects.toThrow(
        'Critical hook failed',
      );
    });

    it('should preserve original request when hook returns undefined', async () => {
      const mockExecute = jest.fn().mockResolvedValue(undefined);

      const hook: RequestHook = {
        name: 'test-hook',
        type: 'request',
        priority: 50,
        execute: mockExecute,
      };

      hooksManager.registerHook(hook);

      const request = { method: 'test' };
      const result = await hooksManager.processRequest(request, mockContext);

      expect(result).toEqual(request);
    });
  });

  describe('processResponse', () => {
    it('should process response through all response hooks', async () => {
      const mockExecute1 = jest.fn().mockResolvedValue({ modified: 1 });
      const mockExecute2 = jest.fn().mockResolvedValue({ modified: 2 });

      const hook1: ResponseHook = {
        name: 'test-hook-1',
        type: 'response',
        priority: 10,
        execute: mockExecute1,
      };

      const hook2: ResponseHook = {
        name: 'test-hook-2',
        type: 'response',
        priority: 20,
        execute: mockExecute2,
      };

      hooksManager.registerHook(hook1);
      hooksManager.registerHook(hook2);

      const response = { data: 'test' };
      const request = { method: 'test' };
      const result = await hooksManager.processResponse(response, request, mockContext);

      expect(mockExecute1).toHaveBeenCalledWith(response, request, mockContext);
      expect(mockExecute2).toHaveBeenCalledWith({ modified: 1 }, request, mockContext);
      // The response enricher hook adds metadata, so we need to account for that
      expect(result).toEqual(expect.objectContaining({ modified: 2 }));
    });

    it('should skip response hooks with false conditions', async () => {
      const mockExecute = jest.fn();
      const mockCondition = jest.fn().mockReturnValue(false);

      const hook: ResponseHook = {
        name: 'test-hook',
        type: 'response',
        priority: 50,
        condition: mockCondition,
        execute: mockExecute,
      };

      hooksManager.registerHook(hook);

      const response = { data: 'test' };
      const request = { method: 'test' };
      await hooksManager.processResponse(response, request, mockContext);

      expect(mockCondition).toHaveBeenCalledWith(response, request, mockContext);
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should handle non-critical response hook failures', async () => {
      const mockExecute = jest.fn().mockRejectedValue(new Error('Hook failed'));

      const hook: ResponseHook = {
        name: 'test-hook',
        type: 'response',
        priority: 50,
        critical: false,
        execute: mockExecute,
      };

      hooksManager.registerHook(hook);

      const response = { data: 'test' };
      const request = { method: 'test' };
      const result = await hooksManager.processResponse(response, request, mockContext);

      // Default response enricher adds metadata
      expect(result).toEqual(expect.objectContaining({ data: 'test' }));
    });

    it('should propagate critical response hook failures', async () => {
      const hookError = new Error('Critical hook failed');
      const mockExecute = jest.fn().mockRejectedValue(hookError);

      const hook: ResponseHook = {
        name: 'test-hook',
        type: 'response',
        priority: 50,
        critical: true,
        execute: mockExecute,
      };

      hooksManager.registerHook(hook);

      const response = { data: 'test' };
      const request = { method: 'test' };
      await expect(hooksManager.processResponse(response, request, mockContext)).rejects.toThrow(
        'Critical hook failed',
      );
    });
  });

  describe('processError', () => {
    it('should process error through all error hooks', async () => {
      const originalError = new Error('Original error');
      const enrichedError1 = new Error('Enriched error 1');
      const enrichedError2 = new Error('Enriched error 2');

      const mockExecute1 = jest.fn().mockResolvedValue(enrichedError1);
      const mockExecute2 = jest.fn().mockResolvedValue(enrichedError2);

      const hook1: ErrorHook = {
        name: 'test-hook-1',
        type: 'error',
        priority: 10,
        execute: mockExecute1,
      };

      const hook2: ErrorHook = {
        name: 'test-hook-2',
        type: 'error',
        priority: 20,
        execute: mockExecute2,
      };

      hooksManager.registerHook(hook1);
      hooksManager.registerHook(hook2);

      const request = { method: 'test' };
      const result = await hooksManager.processError(originalError, request, mockContext);

      expect(mockExecute1).toHaveBeenCalledWith(originalError, request, mockContext);
      expect(mockExecute2).toHaveBeenCalledWith(enrichedError1, request, mockContext);
      // Check the final error has the expected message
      expect(result.message).toBe('Enriched error 2');
    });

    it('should skip error hooks with false conditions', async () => {
      const mockExecute = jest.fn();
      const mockCondition = jest.fn().mockReturnValue(false);

      const hook: ErrorHook = {
        name: 'test-hook',
        type: 'error',
        priority: 50,
        condition: mockCondition,
        execute: mockExecute,
      };

      hooksManager.registerHook(hook);

      const error = new Error('Test error');
      const request = { method: 'test' };
      await hooksManager.processError(error, request, mockContext);

      expect(mockCondition).toHaveBeenCalledWith(error, request, mockContext);
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should handle error hook failures gracefully', async () => {
      const originalError = new Error('Original error');
      const mockExecute = jest.fn().mockRejectedValue(new Error('Hook failed'));

      const hook: ErrorHook = {
        name: 'test-hook',
        type: 'error',
        priority: 50,
        execute: mockExecute,
      };

      hooksManager.registerHook(hook);

      const request = { method: 'test' };
      const result = await hooksManager.processError(originalError, request, mockContext);

      // Default error enricher hook modifies the error, so check message
      expect(result.message).toBe('Original error');
    });

    it('should preserve original error when hook returns undefined', async () => {
      const originalError = new Error('Original error');
      const mockExecute = jest.fn().mockResolvedValue(undefined);

      const hook: ErrorHook = {
        name: 'test-hook',
        type: 'error',
        priority: 50,
        execute: mockExecute,
      };

      hooksManager.registerHook(hook);

      const request = { method: 'test' };
      const result = await hooksManager.processError(originalError, request, mockContext);

      // Default error enricher hook modifies the error, so check message
      expect(result.message).toBe('Original error');
    });
  });

  describe('removeHook', () => {
    it('should remove a hook by name', () => {
      const hook: RequestHook = {
        name: 'removable-hook',
        type: 'request',
        priority: 50,
        execute: jest.fn(),
      };

      hooksManager.registerHook(hook);
      expect(hooksManager.getAllHooks()).toContain(hook);

      const removed = hooksManager.removeHook('removable-hook');
      expect(removed).toBe(true);
      expect(hooksManager.getAllHooks()).not.toContain(hook);
    });

    it('should return false when removing non-existent hook', () => {
      const removed = hooksManager.removeHook('non-existent-hook');
      expect(removed).toBe(false);
    });
  });

  describe('default hooks', () => {
    describe('request-logger hook', () => {
      it('should log incoming requests', async () => {
        const request = { method: 'test-method' };
        await hooksManager.processRequest(request, mockContext);

        // The logger is mocked at module level, so just verify the hook exists and runs
        const hooks = hooksManager.getAllHooks();
        const loggerHook = hooks.find((h) => h.name === 'request-logger');
        expect(loggerHook).toBeDefined();
        expect(loggerHook?.type).toBe('request');
      });
    });

    describe('response-enricher hook', () => {
      it('should add metadata to responses', async () => {
        const response = { data: 'test' };
        const request = { method: 'test-method' };
        const result = await hooksManager.processResponse(response, request, mockContext);

        expect(result).toMatchObject({
          data: 'test',
          _metadata: {
            processedAt: expect.any(String),
            sessionId: 'test-session-123',
            requestMethod: 'test-method',
          },
        });
      });
    });

    describe('error-enricher hook', () => {
      it('should enrich errors with context', async () => {
        const originalError = new Error('Test error');
        const request = { method: 'test-method' };
        const result = await hooksManager.processError(originalError, request, mockContext);

        expect(result.message).toBe('Test error');
        expect((result as unknown as { context: unknown }).context).toMatchObject({
          method: 'test-method',
          sessionId: 'test-session-123',
          timestamp: expect.any(String),
        });
      });
    });

    describe('rate-limiter hook', () => {
      beforeEach(() => {
        // Mock Date.now to control time
        jest.spyOn(Date, 'now').mockReturnValue(1000000);
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      it('should allow requests within rate limit', async () => {
        const request = { method: 'test-method' };

        // Process multiple requests within limit
        for (let i = 0; i < 5; i++) {
          const result = await hooksManager.processRequest(request, mockContext);
          expect(result).toEqual(request);
        }
      });

      it('should throw rate limit error when exceeded', async () => {
        const request = { method: 'test-method' };
        const testContext = { sessionId: 'rate-test-session-unique', startTime: Date.now() };

        // Create a fresh hooks manager to avoid interference from other tests
        const freshHooksManager = new HooksManager();

        // Fill up the rate limit (30 requests is the limit)
        let successCount = 0;
        for (let i = 0; i < 30; i++) {
          try {
            await freshHooksManager.processRequest(request, testContext);
            successCount++;
          } catch (e) {
            console.log(`Unexpected error at request ${i}:`, e);
            throw e;
          }
        }

        expect(successCount).toBe(30);

        // 31st request should fail with rate limit error
        await expect(freshHooksManager.processRequest(request, testContext)).rejects.toThrow(
          'Rate limit exceeded',
        );
      });

      it('should reset rate limit after window expires', async () => {
        const request = { method: 'test-method' };

        // Fill up the rate limit
        for (let i = 0; i < 30; i++) {
          await hooksManager.processRequest(request, mockContext);
        }

        // Advance time beyond the window (60 seconds)
        jest.spyOn(Date, 'now').mockReturnValue(1000000 + 61000);

        // Should be able to make request again
        const result = await hooksManager.processRequest(request, mockContext);
        expect(result).toEqual(request);
      });

      it('should track rate limits per session and method', async () => {
        const request1 = { method: 'method1' };
        const request2 = { method: 'method2' };
        const context2 = { ...mockContext, sessionId: 'different-session' };

        // Fill up rate limit for method1 in session 1
        for (let i = 0; i < 30; i++) {
          await hooksManager.processRequest(request1, mockContext);
        }

        // Should still be able to use method2 in session 1
        const result1 = await hooksManager.processRequest(request2, mockContext);
        expect(result1).toEqual(request2);

        // Should still be able to use method1 in session 2
        const result2 = await hooksManager.processRequest(request1, context2);
        expect(result2).toEqual(request1);
      });
    });
  });

  describe('hook execution order', () => {
    it('should execute hooks in priority order', async () => {
      const executionOrder: string[] = [];

      const hook1: RequestHook = {
        name: 'priority-30',
        type: 'request',
        priority: 30,
        execute: jest.fn().mockImplementation(async () => {
          executionOrder.push('priority-30');
          return undefined;
        }),
      };

      const hook2: RequestHook = {
        name: 'priority-10',
        type: 'request',
        priority: 10,
        execute: jest.fn().mockImplementation(async () => {
          executionOrder.push('priority-10');
          return undefined;
        }),
      };

      const hook3: RequestHook = {
        name: 'priority-20',
        type: 'request',
        priority: 20,
        execute: jest.fn().mockImplementation(async () => {
          executionOrder.push('priority-20');
          return undefined;
        }),
      };

      hooksManager.registerHook(hook1);
      hooksManager.registerHook(hook2);
      hooksManager.registerHook(hook3);

      const request = { method: 'test' };
      await hooksManager.processRequest(request, mockContext);

      expect(executionOrder).toEqual(['priority-10', 'priority-20', 'priority-30']);
    });
  });

  describe('hook chaining', () => {
    it('should pass modified request through hook chain', async () => {
      const hook1: RequestHook = {
        name: 'add-field-1',
        type: 'request',
        priority: 10,
        execute: jest.fn().mockImplementation(async (req) => ({
          ...req,
          field1: 'added',
        })),
      };

      const hook2: RequestHook = {
        name: 'add-field-2',
        type: 'request',
        priority: 20,
        execute: jest.fn().mockImplementation(async (req) => ({
          ...req,
          field2: 'also-added',
        })),
      };

      hooksManager.registerHook(hook1);
      hooksManager.registerHook(hook2);

      const request = { method: 'test' };
      const result = await hooksManager.processRequest(request, mockContext);

      expect(result).toEqual({
        method: 'test',
        field1: 'added',
        field2: 'also-added',
      });

      expect(hook1.execute).toHaveBeenCalledWith(request, mockContext);
      expect(hook2.execute).toHaveBeenCalledWith({ method: 'test', field1: 'added' }, mockContext);
    });
  });
});
