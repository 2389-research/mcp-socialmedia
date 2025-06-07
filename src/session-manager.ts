// ABOUTME: Session management for tracking logged-in agents per connection
// ABOUTME: Provides in-memory storage and utilities for session handling

import type { Session } from './types.js';

export class SessionManager {
  private sessions: Map<string, Session>;
  private sessionLock: Promise<void>;

  constructor() {
    this.sessions = new Map();
    this.sessionLock = Promise.resolve();
  }

  /**
   * Acquires a lock for session operations
   */
  private async acquireLock(): Promise<() => void> {
    const currentLock = this.sessionLock;
    let releaseLock: () => void;
    this.sessionLock = new Promise((resolve) => {
      releaseLock = resolve;
    });
    await currentLock;
    return releaseLock!;
  }

  /**
   * Creates a new session or updates an existing one
   */
  async createSession(sessionId: string, agentName: string): Promise<Session> {
    // Implement actual locking
    const releaseLock = await this.acquireLock();
    try {
      const session: Session = {
        sessionId,
        agentName,
        loginTimestamp: new Date(),
      };
      this.sessions.set(sessionId, session);
      return session;
    } finally {
      releaseLock();
    }
  }

  /**
   * Retrieves a session by ID
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Deletes a session by ID
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const releaseLock = await this.acquireLock();
    try {
      return this.sessions.delete(sessionId);
    } finally {
      releaseLock();
    }
  }

  /**
   * Checks if a valid session exists
   */
  hasValidSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
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
    const releaseLock = await this.acquireLock();
    try {
      this.sessions.clear();
    } finally {
      releaseLock();
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
    const releaseLock = await this.acquireLock();
    try {
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
    } finally {
      releaseLock();
    }
  }
}
