import type { Session } from './types.js';
export declare class SessionManager {
    private sessions;
    constructor();
    /**
     * Creates a new session or updates an existing one
     */
    createSession(sessionId: string, agentName: string): Promise<Session>;
    /**
     * Creates a new session or updates an existing one without locking
     */
    private createSessionUnsafe;
    /**
     * Retrieves a session by ID if valid, otherwise returns undefined
     */
    getSession(sessionId: string): Session | undefined;
    /**
     * Updates session activity timestamp for valid sessions
     */
    updateSessionActivity(sessionId: string): boolean;
    /**
     * Deletes a session by ID
     */
    deleteSession(sessionId: string): Promise<boolean>;
    /**
     * Checks if a valid session exists with proper expiration and validation checks
     */
    hasValidSession(sessionId: string): boolean;
    /**
     * Gets all active sessions (for debugging/monitoring)
     */
    getAllSessions(): Session[];
    /**
     * Clears all sessions
     */
    clearAllSessions(): Promise<void>;
    /**
     * Gets the number of active sessions
     */
    getSessionCount(): number;
    /**
     * Cleans up sessions older than the specified age in milliseconds
     */
    cleanupOldSessions(maxAgeMs: number): Promise<number>;
    /**
     * Cleans up sessions older than the specified age in milliseconds without locking
     */
    private cleanupOldSessionsUnsafe;
}
//# sourceMappingURL=session-manager.d.ts.map