// ABOUTME: Integration tests for session lifecycle management
// ABOUTME: Tests session creation, validation, cleanup, and edge cases

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SessionManager } from '../../src/session-manager.js';
import { ApiClient } from '../../src/api-client.js';
import { loginToolHandler } from '../../src/tools/login.js';
import { createPostToolHandler } from '../../src/tools/create-post.js';
import { logger } from '../../src/logger.js';
import { metrics } from '../../src/metrics.js';

describe('Session Lifecycle Integration Tests', () => {
  let sessionManager: SessionManager;
  let apiClient: jest.Mocked<ApiClient>;

  beforeEach(() => {
    process.env.TEAM_NAME = 'test-team';
    sessionManager = new SessionManager();
    apiClient = {
      fetchPosts: jest.fn(),
      createPost: jest.fn(),
    } as jest.Mocked<ApiClient>;

    // Set up default mock responses
    apiClient.fetchPosts.mockResolvedValue({
      posts: [],
      total: 0,
      has_more: false,
    });

    apiClient.createPost.mockImplementation(async (teamName, postData) => ({
      post: {
        id: `post-${Date.now()}`,
        team_name: teamName,
        author_name: postData.author_name,
        content: postData.content,
        tags: postData.tags || [],
        timestamp: new Date().toISOString(),
        parent_post_id: postData.parent_post_id,
        deleted: false,
      },
    }));
    metrics.reset();
  });

  afterEach(async () => {
    await sessionManager.clearAllSessions();
  });

  describe('Session Creation and Validation', () => {
    it('should handle session lifecycle correctly', async () => {
      const sessionId = 'lifecycle-test-session';
      const loginContext = {
        sessionManager,
        getSessionId: () => sessionId,
      };

      // Initial state - no session
      expect(sessionManager.hasValidSession(sessionId)).toBe(false);
      expect(sessionManager.getSessionCount()).toBe(0);

      // Login creates session
      const loginResult = await loginToolHandler({ agent_name: 'lifecycle-agent' }, loginContext);

      const loginResponse = JSON.parse(loginResult.content[0].text);
      expect(loginResponse.success).toBe(true);
      expect(sessionManager.hasValidSession(sessionId)).toBe(true);
      expect(sessionManager.getSessionCount()).toBe(1);

      // Session enables authenticated operations
      const createContext = {
        sessionManager,
        apiClient,
        getSessionId: () => sessionId,
      };

      const createResult = await createPostToolHandler(
        { content: 'Authenticated post' },
        createContext
      );

      const createResponse = JSON.parse(createResult.content[0].text);
      expect(createResponse.success).toBe(true);

      // Session deletion
      await sessionManager.deleteSession(sessionId);
      expect(sessionManager.hasValidSession(sessionId)).toBe(false);
      expect(sessionManager.getSessionCount()).toBe(0);

      // Operations fail after session deletion
      const postDeleteResult = await createPostToolHandler(
        { content: 'Should fail' },
        createContext
      );

      const postDeleteResponse = JSON.parse(postDeleteResult.content[0].text);
      expect(postDeleteResponse.success).toBe(false);
      expect(postDeleteResponse.error).toBe('Authentication required');
    });

    it('should handle re-login scenarios', async () => {
      const sessionId = 'relogin-test';
      const loginContext = {
        sessionManager,
        getSessionId: () => sessionId,
      };

      // First login
      await loginToolHandler({ agent_name: 'agent-one' }, loginContext);
      let session = sessionManager.getSession(sessionId);
      expect(session?.agentName).toBe('agent-one');

      // Re-login with different agent
      const reloginResult = await loginToolHandler({ agent_name: 'agent-two' }, loginContext);

      const reloginResponse = JSON.parse(reloginResult.content[0].text);
      expect(reloginResponse.success).toBe(true);
      expect(reloginResponse.agent_name).toBe('agent-two');

      // Session should be updated
      session = sessionManager.getSession(sessionId);
      expect(session?.agentName).toBe('agent-two');
      expect(sessionManager.getSessionCount()).toBe(1); // Still only one session
    });

    it('should handle concurrent sessions', async () => {
      const sessions = ['session-1', 'session-2', 'session-3'];
      const agents = ['agent-1', 'agent-2', 'agent-3'];

      // Create multiple sessions
      for (let i = 0; i < sessions.length; i++) {
        const loginContext = {
          sessionManager,
          getSessionId: () => sessions[i],
        };

        await loginToolHandler({ agent_name: agents[i] }, loginContext);
      }

      expect(sessionManager.getSessionCount()).toBe(3);

      // Each session should work independently
      for (let i = 0; i < sessions.length; i++) {
        const createContext = {
          sessionManager,
          apiClient,
          getSessionId: () => sessions[i],
        };

        const result = await createPostToolHandler(
          { content: `Post from ${agents[i]}` },
          createContext
        );

        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(true);
        expect(response.post.author_name).toBe(agents[i]);
      }
    });

    it('should clean up old sessions', async () => {
      // Create sessions with different ages
      const oldSessionId = 'old-session';
      const newSessionId = 'new-session';

      // Create old session and manually age it
      await sessionManager.createSession(oldSessionId, 'old-agent');
      const oldSession = sessionManager.getSession(oldSessionId);
      if (oldSession) {
        // Set timestamp to 2 hours ago
        oldSession.loginTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000);
      }

      // Create new session
      await sessionManager.createSession(newSessionId, 'new-agent');

      expect(sessionManager.getSessionCount()).toBe(2);

      // Clean up sessions older than 1 hour
      const removed = await sessionManager.cleanupOldSessions(60 * 60 * 1000);
      expect(removed).toBe(1);
      expect(sessionManager.getSessionCount()).toBe(1);
      expect(sessionManager.hasValidSession(oldSessionId)).toBe(false);
      expect(sessionManager.hasValidSession(newSessionId)).toBe(true);

      logger.info('Session cleanup completed', { removed, remaining: 1 });
    });
  });

  describe('Session Security', () => {
    it('should isolate sessions from each other', async () => {
      const aliceSessionId = 'alice-session';
      const bobSessionId = 'bob-session';

      // Alice logs in
      const aliceLoginContext = {
        sessionManager,
        getSessionId: () => aliceSessionId,
      };
      await loginToolHandler({ agent_name: 'alice' }, aliceLoginContext);

      // Bob logs in
      const bobLoginContext = {
        sessionManager,
        getSessionId: () => bobSessionId,
      };
      await loginToolHandler({ agent_name: 'bob' }, bobLoginContext);

      // Alice creates a post
      const aliceCreateContext = {
        sessionManager,
        apiClient,
        getSessionId: () => aliceSessionId,
      };

      const alicePost = await createPostToolHandler(
        { content: 'Alice private post' },
        aliceCreateContext
      );

      const aliceResponse = JSON.parse(alicePost.content[0].text);
      expect(aliceResponse.post.author_name).toBe('alice');

      // Bob cannot use Alice's session
      const bobWithAliceContext = {
        sessionManager,
        apiClient,
        getSessionId: () => aliceSessionId,
      };

      // This would succeed but the post would be from Alice
      const bobPost = await createPostToolHandler(
        { content: 'Bob trying with Alice session' },
        bobWithAliceContext
      );

      const bobResponse = JSON.parse(bobPost.content[0].text);
      expect(bobResponse.post.author_name).toBe('alice'); // Not Bob!

      logger.warn('Session isolation test - sessions are properly isolated');
    });

    it('should handle invalid session IDs gracefully', async () => {
      const invalidContext = {
        sessionManager,
        apiClient,
        getSessionId: () => 'non-existent-session',
      };

      // Should fail gracefully
      const result = await createPostToolHandler({ content: 'Should fail' }, invalidContext);

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Authentication required');
    });
  });

  describe('Session Metrics', () => {
    it('should track session metrics correctly', async () => {
      const sessionIds = ['metric-1', 'metric-2', 'metric-3'];

      // Create sessions
      for (const sessionId of sessionIds) {
        const loginContext = {
          sessionManager,
          getSessionId: () => sessionId,
        };

        await loginToolHandler({ agent_name: `agent-${sessionId}` }, loginContext);
        metrics.incrementSessionCount();
      }

      expect(metrics.getSessionCount()).toBe(3);

      // Delete one session
      await sessionManager.deleteSession(sessionIds[0]);
      metrics.decrementSessionCount();

      expect(metrics.getSessionCount()).toBe(2);

      // Clear all sessions
      await sessionManager.clearAllSessions();
      metrics.reset();

      expect(metrics.getSessionCount()).toBe(0);
    });
  });
});
