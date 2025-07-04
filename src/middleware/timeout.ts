// ABOUTME: Timeout management for MCP requests
// ABOUTME: Prevents hanging requests and provides configurable timeout handling

import { logger } from '../logger.js';
import { McpTimeoutError } from './error-handler.js';

// Simple async lock implementation for thread safety
class AsyncLock {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const unlock = () => {
        this.locked = false;
        const next = this.queue.shift();
        if (next) {
          this.locked = true;
          next();
        }
      };

      if (this.locked) {
        this.queue.push(() => resolve(unlock));
      } else {
        this.locked = true;
        resolve(unlock);
      }
    });
  }
}

export interface TimeoutConfig {
  defaultTimeout: number;
  methodTimeouts: Record<string, number>;
  maxTimeout: number;
}

export class TimeoutManager {
  private readonly config: TimeoutConfig;
  private timeoutCount = 0;
  private activeTimeouts = new Set<NodeJS.Timeout>();
  private readonly timeoutLock = new AsyncLock();

  constructor(config?: Partial<TimeoutConfig>) {
    this.config = {
      defaultTimeout: 30000, // 30 seconds
      maxTimeout: 120000, // 2 minutes
      methodTimeouts: {
        'tools/call': 60000, // Tool calls can take longer
        'sampling/create': 90000, // LLM requests need more time
        'resources/read': 10000, // Resource reads should be fast
        'resources/list': 5000,
        'tools/list': 5000,
        'prompts/list': 5000,
        'prompts/get': 10000,
        'roots/list': 5000,
        ...config?.methodTimeouts,
      },
      ...config,
    };

    logger.info('Timeout manager initialized', {
      defaultTimeout: this.config.defaultTimeout,
      maxTimeout: this.config.maxTimeout,
      methodTimeouts: Object.keys(this.config.methodTimeouts).length,
    });
  }

  /**
   * Create a timeout promise for a specific method
   */
  createTimeout(method: string): Promise<never> {
    const timeoutMs = this.getTimeoutForMethod(method);

    return new Promise((_, reject) => {
      const timeoutId = setTimeout(async () => {
        // Use lock for thread-safe updates
        const unlock = await this.timeoutLock.acquire();
        try {
          this.timeoutCount++;
          this.activeTimeouts.delete(timeoutId);
        } finally {
          unlock();
        }

        logger.warn('Request timed out', {
          method,
          timeout: timeoutMs,
          totalTimeouts: this.timeoutCount,
        });

        const error = new McpTimeoutError(`Request timed out after ${timeoutMs}ms`, timeoutMs);
        reject(error);
      }, timeoutMs);

      // Thread-safe addition to active timeouts
      this.activeTimeouts.add(timeoutId);
    });
  }

  /**
   * Create a timeout promise that can be cleared
   */
  createClearableTimeout(method: string): {
    promise: Promise<never>;
    clear: () => void;
  } {
    const timeoutMs = this.getTimeoutForMethod(method);
    let timeoutId: NodeJS.Timeout;

    const promise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(async () => {
        // Use lock for thread-safe updates
        const unlock = await this.timeoutLock.acquire();
        try {
          this.timeoutCount++;
          this.activeTimeouts.delete(timeoutId);
        } finally {
          unlock();
        }

        logger.warn('Request timed out', {
          method,
          timeout: timeoutMs,
        });

        const error = new McpTimeoutError(`Request timed out after ${timeoutMs}ms`, timeoutMs);
        reject(error);
      }, timeoutMs);

      this.activeTimeouts.add(timeoutId);
    });

    const clear = async () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        // Use lock for thread-safe removal
        const unlock = await this.timeoutLock.acquire();
        try {
          this.activeTimeouts.delete(timeoutId);
        } finally {
          unlock();
        }
      }
    };

    return { promise, clear };
  }

  /**
   * Wrap a promise with timeout
   */
  async withTimeout<T>(promise: Promise<T>, method: string): Promise<T> {
    const { promise: timeoutPromise, clear } = this.createClearableTimeout(method);

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clear();
      return result;
    } catch (error) {
      clear();
      throw error;
    }
  }

  /**
   * Get timeout duration for a specific method
   */
  private getTimeoutForMethod(method: string): number {
    const methodTimeout = this.config.methodTimeouts[method];
    if (methodTimeout) {
      return Math.min(methodTimeout, this.config.maxTimeout);
    }
    return this.config.defaultTimeout;
  }

  /**
   * Clear all active timeouts
   */
  async clearAllTimeouts(): Promise<void> {
    const unlock = await this.timeoutLock.acquire();
    try {
      for (const timeoutId of this.activeTimeouts) {
        clearTimeout(timeoutId);
      }
      this.activeTimeouts.clear();
    } finally {
      unlock();
    }
    logger.info('Cleared all active timeouts');
  }

  /**
   * Get timeout statistics
   */
  getStats() {
    return {
      totalTimeouts: this.timeoutCount,
      activeTimeouts: this.activeTimeouts.size,
      config: {
        defaultTimeout: this.config.defaultTimeout,
        maxTimeout: this.config.maxTimeout,
        methodTimeoutCount: Object.keys(this.config.methodTimeouts).length,
      },
    };
  }

  /**
   * Update timeout configuration
   */
  updateConfig(newConfig: Partial<TimeoutConfig>): void {
    Object.assign(this.config, newConfig);
    logger.info('Timeout configuration updated', { config: this.config });
  }
}
