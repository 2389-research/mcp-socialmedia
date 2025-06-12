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
    let releaseLock: (() => void) | undefined;
    this.sessionLock = new Promise((resolve) => {
      releaseLock = resolve;
    });
    await currentLock;
    if (!releaseLock) {
      throw new Error('Failed to acquire session lock');
    }
    return releaseLock;
  }

  /**
   * Creates a new session or updates an existing one
   */
  async createSession(sessionId: string, agentName: string): Promise<Session> {
    // Implement actual locking
    const releaseLock = await this.acquireLock();
    try {
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
    } finally {
      releaseLock();
    }
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
    const releaseLock = await this.acquireLock();
    try {
      return this.sessions.delete(sessionId);
    } finally {
      releaseLock();
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
