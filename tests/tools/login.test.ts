// ABOUTME: Tests for the login tool functionality
// ABOUTME: Validates input validation, session creation, and error handling

import { jest } from '@jest/globals';
import { config } from '../../src/config';
import { SessionManager } from '../../src/session-manager';
import { type LoginToolContext, loginToolHandler } from '../../src/tools/login';
import type { LoginToolResponse } from '../../src/types';

describe('Login Tool', () => {
  let sessionManager: SessionManager;
  let context: LoginToolContext;
  let mockGetSessionId: jest.Mock<() => string>;

  beforeEach(() => {
    sessionManager = new SessionManager();
    mockGetSessionId = jest.fn(() => `test-session-${Date.now()}`);
    context = {
      sessionManager,
      getSessionId: mockGetSessionId,
    };

    // Set up environment
    process.env.SOCIALMEDIA_TEAM_ID = config.teamName;
  });

  describe('Successful login', () => {
    it('should create a new session for valid agent name', async () => {
      const agentName = 'test-agent';
      const result = await loginToolHandler({ agent_name: agentName }, context);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const response: LoginToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.agent_name).toBe(agentName);
      expect(response.team_name).toBe(config.teamName);
      expect(response.session_id).toBeDefined();

      // Verify session was created
      const sessionId = response.session_id;
      const session = sessionManager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.agentName).toBe(agentName);
    });

    it('should trim whitespace from agent name', async () => {
      const agentName = '  test-agent  ';
      const result = await loginToolHandler({ agent_name: agentName }, context);

      const response: LoginToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.agent_name).toBe('test-agent');
    });

    it('should handle agent names with special characters', async () => {
      const agentName = 'agent-123_特殊字符';
      const result = await loginToolHandler({ agent_name: agentName }, context);

      const response: LoginToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.agent_name).toBe(agentName);
    });
  });

  describe('Re-login scenarios', () => {
    it('should update existing session on re-login', async () => {
      const sessionId = 'existing-session';
      mockGetSessionId.mockReturnValue(sessionId);

      // First login
      await sessionManager.createSession(sessionId, 'agent-1');

      // Re-login with different agent
      const result = await loginToolHandler({ agent_name: 'agent-2' }, context);

      const response: LoginToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.agent_name).toBe('agent-2');

      // Verify session was updated
      const session = sessionManager.getSession(sessionId);
      expect(session?.agentName).toBe('agent-2');
    });

    it('should preserve session ID on re-login', async () => {
      const sessionId = 'persistent-session';
      mockGetSessionId.mockReturnValue(sessionId);

      // First login
      const result1 = await loginToolHandler({ agent_name: 'agent-1' }, context);
      const response1: LoginToolResponse = JSON.parse(result1.content[0].text);

      // Re-login
      const result2 = await loginToolHandler({ agent_name: 'agent-2' }, context);
      const response2: LoginToolResponse = JSON.parse(result2.content[0].text);

      expect(response1.session_id).toBe(sessionId);
      expect(response2.session_id).toBe(sessionId);
    });
  });

  describe('Input validation', () => {
    it('should reject empty agent name', async () => {
      const result = await loginToolHandler({ agent_name: '' }, context);

      const response: LoginToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid input');
      expect(response.details).toContain('Agent name must not be empty');
    });

    it('should reject whitespace-only agent name', async () => {
      const result = await loginToolHandler({ agent_name: '   ' }, context);

      const response: LoginToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid input');
    });

    it('should reject null agent name', async () => {
      const result = await loginToolHandler({ agent_name: null as unknown as string }, context);

      const response: LoginToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid input');
    });

    it('should reject undefined agent name', async () => {
      const result = await loginToolHandler(
        { agent_name: undefined as unknown as string },
        context,
      );

      const response: LoginToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid input');
    });
  });

  describe('Error handling', () => {
    it('should handle session creation failure', async () => {
      // Mock session creation to throw error
      jest
        .spyOn(sessionManager, 'createSession')
        .mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await loginToolHandler({ agent_name: 'test-agent' }, context);

      const response: LoginToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Failed to create session');
      expect(response.details).toBe('Database connection failed');
    });

    it('should handle unexpected errors', async () => {
      // Mock session creation to throw non-Error
      jest.spyOn(sessionManager, 'createSession').mockRejectedValueOnce('String error');

      const result = await loginToolHandler({ agent_name: 'test-agent' }, context);

      const response: LoginToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Failed to create session');
      expect(response.details).toBe('Unknown error');
    });
  });

  describe('Session ID generation', () => {
    it('should use provided session ID function', async () => {
      const customSessionId = 'custom-session-123';
      mockGetSessionId.mockReturnValue(customSessionId);

      const result = await loginToolHandler({ agent_name: 'test-agent' }, context);

      const response: LoginToolResponse = JSON.parse(result.content[0].text);
      expect(response.session_id).toBe(customSessionId);
      expect(mockGetSessionId).toHaveBeenCalled();
    });

    it('should call session ID function once per login', async () => {
      await loginToolHandler({ agent_name: 'test-agent' }, context);
      expect(mockGetSessionId).toHaveBeenCalledTimes(1);
    });
  });

  describe('Response format', () => {
    it('should always return MCP-compliant response structure', async () => {
      const result = await loginToolHandler({ agent_name: 'test-agent' }, context);

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
      expect(typeof result.content[0].text).toBe('string');

      // Verify JSON is valid
      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });

    it('should include all required fields in success response', async () => {
      const result = await loginToolHandler({ agent_name: 'test-agent' }, context);
      const response: LoginToolResponse = JSON.parse(result.content[0].text);

      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('agent_name');
      expect(response).toHaveProperty('team_name');
      expect(response).toHaveProperty('session_id');
      expect(response).not.toHaveProperty('error');
      expect(response).not.toHaveProperty('details');
    });

    it('should include error fields in failure response', async () => {
      const result = await loginToolHandler({ agent_name: '' }, context);
      const response: LoginToolResponse = JSON.parse(result.content[0].text);

      expect(response).toHaveProperty('success', false);
      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('details');
      expect(response).not.toHaveProperty('agent_name');
      expect(response).not.toHaveProperty('team_name');
      expect(response).not.toHaveProperty('session_id');
    });
  });
});
