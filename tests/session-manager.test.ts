// ABOUTME: Tests for SessionManager functionality
// ABOUTME: Validates session creation, retrieval, deletion, and cleanup

import { jest } from '@jest/globals';
import { SessionManager } from '../src/session-manager';
import { Session } from '../src/types';

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const sessionId = 'test-session-123';
      const agentName = 'test-agent';

      const session = await sessionManager.createSession(sessionId, agentName);

      expect(session).toBeDefined();
      expect(session.sessionId).toBe(sessionId);
      expect(session.agentName).toBe(agentName);
      expect(session.loginTimestamp).toBeInstanceOf(Date);
    });

    it('should update an existing session', async () => {
      const sessionId = 'test-session-123';
      const firstAgent = 'agent-1';
      const secondAgent = 'agent-2';

      const firstSession = await sessionManager.createSession(sessionId, firstAgent);
      const firstTimestamp = firstSession.loginTimestamp;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const secondSession = await sessionManager.createSession(sessionId, secondAgent);

      expect(secondSession.agentName).toBe(secondAgent);
      expect(secondSession.loginTimestamp.getTime()).toBeGreaterThan(firstTimestamp.getTime());
    });
  });

  describe('getSession', () => {
    it('should retrieve an existing session', async () => {
      const sessionId = 'test-session-123';
      const agentName = 'test-agent';

      await sessionManager.createSession(sessionId, agentName);
      const retrieved = sessionManager.getSession(sessionId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe(sessionId);
      expect(retrieved?.agentName).toBe(agentName);
    });

    it('should return undefined for non-existent session', () => {
      const retrieved = sessionManager.getSession('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('deleteSession', () => {
    it('should delete an existing session', async () => {
      const sessionId = 'test-session-123';
      await sessionManager.createSession(sessionId, 'test-agent');

      const deleted = sessionManager.deleteSession(sessionId);
      expect(deleted).toBe(true);

      const retrieved = sessionManager.getSession(sessionId);
      expect(retrieved).toBeUndefined();
    });

    it('should return false when deleting non-existent session', () => {
      const deleted = sessionManager.deleteSession('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('hasValidSession', () => {
    it('should return true for existing session', async () => {
      const sessionId = 'test-session-123';
      await sessionManager.createSession(sessionId, 'test-agent');

      expect(sessionManager.hasValidSession(sessionId)).toBe(true);
    });

    it('should return false for non-existent session', () => {
      expect(sessionManager.hasValidSession('non-existent')).toBe(false);
    });
  });

  describe('getAllSessions', () => {
    it('should return all active sessions', async () => {
      await sessionManager.createSession('session-1', 'agent-1');
      await sessionManager.createSession('session-2', 'agent-2');
      await sessionManager.createSession('session-3', 'agent-3');

      const allSessions = sessionManager.getAllSessions();
      expect(allSessions).toHaveLength(3);
      
      const sessionIds = allSessions.map(s => s.sessionId);
      expect(sessionIds).toContain('session-1');
      expect(sessionIds).toContain('session-2');
      expect(sessionIds).toContain('session-3');
    });

    it('should return empty array when no sessions exist', () => {
      const allSessions = sessionManager.getAllSessions();
      expect(allSessions).toEqual([]);
    });
  });

  describe('clearAllSessions', () => {
    it('should remove all sessions', async () => {
      await sessionManager.createSession('session-1', 'agent-1');
      await sessionManager.createSession('session-2', 'agent-2');

      sessionManager.clearAllSessions();

      expect(sessionManager.getSessionCount()).toBe(0);
      expect(sessionManager.getAllSessions()).toEqual([]);
    });
  });

  describe('getSessionCount', () => {
    it('should return correct session count', async () => {
      expect(sessionManager.getSessionCount()).toBe(0);

      await sessionManager.createSession('session-1', 'agent-1');
      expect(sessionManager.getSessionCount()).toBe(1);

      await sessionManager.createSession('session-2', 'agent-2');
      expect(sessionManager.getSessionCount()).toBe(2);

      sessionManager.deleteSession('session-1');
      expect(sessionManager.getSessionCount()).toBe(1);
    });
  });

  describe('cleanupOldSessions', () => {
    it('should remove sessions older than specified age', async () => {
      // Create sessions with different timestamps
      const oldSession = await sessionManager.createSession('old-session', 'old-agent');
      
      // Manually set old timestamp
      oldSession.loginTimestamp = new Date(Date.now() - 3600000); // 1 hour ago

      // Create recent sessions
      await sessionManager.createSession('recent-1', 'agent-1');
      await sessionManager.createSession('recent-2', 'agent-2');

      // Cleanup sessions older than 30 minutes
      const removed = sessionManager.cleanupOldSessions(1800000);

      expect(removed).toBe(1);
      expect(sessionManager.getSessionCount()).toBe(2);
      expect(sessionManager.hasValidSession('old-session')).toBe(false);
      expect(sessionManager.hasValidSession('recent-1')).toBe(true);
      expect(sessionManager.hasValidSession('recent-2')).toBe(true);
    });

    it('should not remove any sessions if all are recent', async () => {
      await sessionManager.createSession('session-1', 'agent-1');
      await sessionManager.createSession('session-2', 'agent-2');

      const removed = sessionManager.cleanupOldSessions(3600000); // 1 hour

      expect(removed).toBe(0);
      expect(sessionManager.getSessionCount()).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string sessionId', async () => {
      const session = await sessionManager.createSession('', 'agent');
      expect(session.sessionId).toBe('');
      expect(sessionManager.hasValidSession('')).toBe(true);
    });

    it('should handle empty string agentName', async () => {
      const session = await sessionManager.createSession('session-123', '');
      expect(session.agentName).toBe('');
    });

    it('should handle special characters in sessionId and agentName', async () => {
      const sessionId = 'session-!@#$%^&*()_+-=[]{}|;:,.<>?';
      const agentName = 'agent-特殊字符-🎯';

      const session = await sessionManager.createSession(sessionId, agentName);
      expect(session.sessionId).toBe(sessionId);
      expect(session.agentName).toBe(agentName);

      const retrieved = sessionManager.getSession(sessionId);
      expect(retrieved?.agentName).toBe(agentName);
    });

    it('should handle concurrent session operations', async () => {
      const promises = [];
      
      // Create 100 sessions concurrently
      for (let i = 0; i < 100; i++) {
        promises.push(sessionManager.createSession(`session-${i}`, `agent-${i}`));
      }

      await Promise.all(promises);
      expect(sessionManager.getSessionCount()).toBe(100);
    });
  });

  describe('memory cleanup', () => {
    it('should release memory when sessions are deleted', async () => {
      // Create and delete many sessions
      for (let i = 0; i < 1000; i++) {
        await sessionManager.createSession(`session-${i}`, `agent-${i}`);
      }

      expect(sessionManager.getSessionCount()).toBe(1000);

      // Delete all sessions
      for (let i = 0; i < 1000; i++) {
        sessionManager.deleteSession(`session-${i}`);
      }

      expect(sessionManager.getSessionCount()).toBe(0);
      expect(sessionManager.getAllSessions()).toEqual([]);
    });
  });
});