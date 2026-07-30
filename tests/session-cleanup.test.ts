// ABOUTME: Tests resilient periodic session cleanup behavior
// ABOUTME: Verifies success logging and contained cleanup failures

import { jest } from '@jest/globals';
import { cleanupExpiredSessions } from '../src/session-cleanup';

describe('cleanupExpiredSessions', () => {
  const cleanupLogger = {
    error: jest.fn(),
    info: jest.fn(),
  };

  beforeEach(() => {
    cleanupLogger.error.mockClear();
    cleanupLogger.info.mockClear();
  });

  it('logs removed sessions with the configured maximum age', async () => {
    const sessionManager = {
      cleanupOldSessions: jest.fn(async () => 2),
    };

    await cleanupExpiredSessions(sessionManager, cleanupLogger, 5000);

    expect(sessionManager.cleanupOldSessions).toHaveBeenCalledWith(5000);
    expect(cleanupLogger.info).toHaveBeenCalledWith('Cleaned up 2 old sessions');
    expect(cleanupLogger.error).not.toHaveBeenCalled();
  });

  it('contains cleanup failures so later interval runs can continue', async () => {
    const sessionManager = {
      cleanupOldSessions: jest
        .fn<() => Promise<number>>()
        .mockRejectedValueOnce(new Error('database unavailable'))
        .mockResolvedValueOnce(1),
    };

    await expect(cleanupExpiredSessions(sessionManager, cleanupLogger)).resolves.toBeUndefined();
    await expect(cleanupExpiredSessions(sessionManager, cleanupLogger)).resolves.toBeUndefined();

    expect(sessionManager.cleanupOldSessions).toHaveBeenCalledTimes(2);
    expect(cleanupLogger.error).toHaveBeenCalledWith('Session cleanup failed', {
      error: 'database unavailable',
    });
    expect(cleanupLogger.info).toHaveBeenCalledWith('Cleaned up 1 old sessions');
  });
});
