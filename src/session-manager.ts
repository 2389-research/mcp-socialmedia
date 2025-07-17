// ABOUTME: Session management for tracking logged-in agents per connection
// ABOUTME: Provides in-memory storage and utilities for session handling

import type { Session } from './types.js';

export class SessionManager {
  private sessions: Map<string, Session>;
  private sessionLock: Promise<void>;
  private lockTimeout: number;
  private lockMetrics: {
    acquisitions: number;
    releases: number;
    timeouts: number;
    failures: number;
  };

  constructor(lockTimeout = 30000) {
    this.sessions = new Map();
    this.sessionLock = Promise.resolve();
    this.lockTimeout = lockTimeout;
    this.lockMetrics = { acquisitions: 0, releases: 0, timeouts: 0, failures: 0 };
  }

  /**
   * Acquires a lock for session operations with timeout and health monitoring
   */
  private async acquireLock(): Promise<() => void> {
    const startTime = Date.now();
    const currentLock = this.sessionLock;
    let releaseLock: (() => void) | undefined;

    this.sessionLock = new Promise((resolve) => {
      releaseLock = () => {
        this.lockMetrics.releases++;
        console.log(`[SessionManager] Lock released after ${Date.now() - startTime}ms`);
        resolve();
      };
    });

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          this.lockMetrics.timeouts++;
          console.error(`[SessionManager] Lock acquisition timed out after ${this.lockTimeout}ms`);
          reject(new Error(`Lock acquisition timed out after ${this.lockTimeout}ms`));
        }, this.lockTimeout);
      });

      // Race between lock acquisition and timeout
      await Promise.race([currentLock, timeoutPromise]);

      if (!releaseLock) {
        this.lockMetrics.failures++;
        throw new Error('Failed to acquire session lock');
      }

      this.lockMetrics.acquisitions++;
      console.log(`[SessionManager] Lock acquired after ${Date.now() - startTime}ms`);
      return releaseLock;
    } catch (error) {
      this.lockMetrics.failures++;
      console.error('[SessionManager] Lock acquisition failed:', error);
      throw error;
    }
  }

  /**
   * Creates a new session or updates an existing one
   */
  async createSession(sessionId: string, agentName: string): Promise<Session> {
    try {
      // Attempt to acquire lock
      const releaseLock = await this.acquireLock();
      try {
        return this.createSessionUnsafe(sessionId, agentName);
      } finally {
        releaseLock();
      }
    } catch (error) {
      // Fallback to non-locking operation on lock failure
      console.warn(
        '[SessionManager] Lock acquisition failed, falling back to non-locking operation:',
        error,
      );
      return this.createSessionUnsafe(sessionId, agentName);
    }
  }

  /**
   * Creates a new session or updates an existing one without locking
   */
  private createSessionUnsafe(sessionId: string, agentName: string): Session {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
    const session: Session = {
      sessionId,
      agentName,
      loginTimestamp: now,
      lastActivity: now,
      expiresAt,
      isValid: true,
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Retrieves a session by ID if valid, otherwise returns undefined
   */
  getSession(sessionId: string): Session | undefined {
    if (!this.hasValidSession(sessionId)) {
      return undefined;
    }
    return this.sessions.get(sessionId);
  }

  /**
   * Updates session activity timestamp for valid sessions
   */
  updateSessionActivity(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !this.hasValidSession(sessionId)) {
      return false;
    }

    session.lastActivity = new Date();
    this.sessions.set(sessionId, session);
    return true;
  }

  /**
   * Deletes a session by ID
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      // Attempt to acquire lock
      const releaseLock = await this.acquireLock();
      try {
        return this.sessions.delete(sessionId);
      } finally {
        releaseLock();
      }
    } catch (error) {
      // Fallback to non-locking operation on lock failure
      console.warn(
        '[SessionManager] Lock acquisition failed, falling back to non-locking operation:',
        error,
      );
      return this.sessions.delete(sessionId);
    }
  }

  /**
   * Checks if a valid session exists with proper expiration and validation checks
   */
  hasValidSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const now = new Date();

    // Check if session is marked as invalid
    if (!session.isValid) {
      return false;
    }

    // Check if session has expired
    if (now > session.expiresAt) {
      // Auto-invalidate expired session
      session.isValid = false;
      this.sessions.set(sessionId, session);
      return false;
    }

    // Check if session has been inactive for too long (4 hours)
    const inactiveThreshold = 4 * 60 * 60 * 1000; // 4 hours
    if (now.getTime() - session.lastActivity.getTime() > inactiveThreshold) {
      session.isValid = false;
      this.sessions.set(sessionId, session);
      return false;
    }

    return true;
  }

  /**
   * Gets all active sessions (for debugging/monitoring)
   */
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Clears all sessions
   */
  async clearAllSessions(): Promise<void> {
    try {
      // Attempt to acquire lock
      const releaseLock = await this.acquireLock();
      try {
        this.sessions.clear();
      } finally {
        releaseLock();
      }
    } catch (error) {
      // Fallback to non-locking operation on lock failure
      console.warn(
        '[SessionManager] Lock acquisition failed, falling back to non-locking operation:',
        error,
      );
      this.sessions.clear();
    }
  }

  /**
   * Gets the number of active sessions
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Cleans up sessions older than the specified age in milliseconds
   */
  async cleanupOldSessions(maxAgeMs: number): Promise<number> {
    try {
      // Attempt to acquire lock
      const releaseLock = await this.acquireLock();
      try {
        return this.cleanupOldSessionsUnsafe(maxAgeMs);
      } finally {
        releaseLock();
      }
    } catch (error) {
      // Fallback to non-locking operation on lock failure
      console.warn(
        '[SessionManager] Lock acquisition failed, falling back to non-locking operation:',
        error,
      );
      return this.cleanupOldSessionsUnsafe(maxAgeMs);
    }
  }

  /**
   * Cleans up sessions older than the specified age in milliseconds without locking
   */
  private cleanupOldSessionsUnsafe(maxAgeMs: number): number {
    const now = new Date();
    let removedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now.getTime() - session.loginTimestamp.getTime();
      if (age > maxAgeMs) {
        this.sessions.delete(sessionId);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Gets lock health metrics for monitoring
   */
  getLockMetrics(): { acquisitions: number; releases: number; timeouts: number; failures: number } {
    return { ...this.lockMetrics };
  }
}
