// ABOUTME: Session management for tracking logged-in agents per connection
// ABOUTME: Provides in-memory storage and utilities for session handling
export class SessionManager {
    sessions;
    constructor() {
        this.sessions = new Map();
    }
    /**
     * Creates a new session or updates an existing one
     */
    async createSession(sessionId, agentName) {
        return this.createSessionUnsafe(sessionId, agentName);
    }
    /**
     * Creates a new session or updates an existing one without locking
     */
    createSessionUnsafe(sessionId, agentName) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
        const session = {
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
    getSession(sessionId) {
        if (!this.hasValidSession(sessionId)) {
            return undefined;
        }
        return this.sessions.get(sessionId);
    }
    /**
     * Updates session activity timestamp for valid sessions
     */
    updateSessionActivity(sessionId) {
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
    async deleteSession(sessionId) {
        return this.sessions.delete(sessionId);
    }
    /**
     * Checks if a valid session exists with proper expiration and validation checks
     */
    hasValidSession(sessionId) {
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
    getAllSessions() {
        return Array.from(this.sessions.values());
    }
    /**
     * Clears all sessions
     */
    async clearAllSessions() {
        this.sessions.clear();
    }
    /**
     * Gets the number of active sessions
     */
    getSessionCount() {
        return this.sessions.size;
    }
    /**
     * Cleans up sessions older than the specified age in milliseconds
     */
    async cleanupOldSessions(maxAgeMs) {
        return this.cleanupOldSessionsUnsafe(maxAgeMs);
    }
    /**
     * Cleans up sessions older than the specified age in milliseconds without locking
     */
    cleanupOldSessionsUnsafe(maxAgeMs) {
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
//# sourceMappingURL=session-manager.js.map