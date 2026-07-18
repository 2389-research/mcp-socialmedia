// ABOUTME: Resilient periodic session cleanup for the MCP server
// ABOUTME: Contains cleanup failures so later scheduled runs can continue

import { type Logger, logger } from './logger.js';
import type { SessionManager } from './session-manager.js';

type CleanupSessionManager = Pick<SessionManager, 'cleanupOldSessions'>;
type CleanupLogger = Pick<Logger, 'error' | 'info'>;

/** Remove expired sessions without allowing one failure to reject the interval callback. */
export async function cleanupExpiredSessions(
  sessionManager: CleanupSessionManager,
  cleanupLogger: CleanupLogger = logger,
  maxAgeMs = 3_600_000,
): Promise<void> {
  try {
    const removed = await sessionManager.cleanupOldSessions(maxAgeMs);
    if (removed > 0) {
      cleanupLogger.info(`Cleaned up ${removed} old sessions`);
    }
  } catch (error) {
    cleanupLogger.error('Session cleanup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
