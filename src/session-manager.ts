// ABOUTME: Session management for tracking logged-in agents per connection
// ABOUTME: Provides in-memory storage and utilities for session handling

import { Session } from './types.js';

export class SessionManager {
  private sessions: Map<string, Session>;
  private sessionLock: Promise<void>;

  constructor() {
    this.sessions = new Map();
    this.sessionLock = Promise.resolve();
  }

  /**
   * Creates a new session or updates an existing one
   */
  async createSession(sessionId: string, agentName: string): Promise<Session> {
    // Ensure thread-safe operations
    await this.sessionLock;

    const session: Session = {
      sessionId,
      agentName,
      loginTimestamp: new Date(),
    };

    this.sessions.set(sessionId, session);
    return session;
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
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
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
  clearAllSessions(): void {
    this.sessions.clear();
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
  cleanupOldSessions(maxAgeMs: number): number {
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
}
