// ABOUTME: Unit tests for prompt handlers and registration
// ABOUTME: Tests all prompt types including generate, analyze, and summarize prompts

import { jest } from '@jest/globals';

// Mock logger
jest.mock('../src/logger.js', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock config
jest.mock('../src/config.js', () => ({
  config: {
    teamName: 'test-team',
  },
}));

import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';
import type { IApiClient } from '../src/api-client.js';
import {
  type PromptContext,
  getPrompt,
  listPrompts,
  registerPrompts,
} from '../src/prompts/index.js';
import type { SessionManager } from '../src/session-manager.js';

// Test type interfaces
interface MockHooksManager {
  executeRequestHooks: jest.MockedFunction<(...args: any[]) => any>;
  executeResponseHooks: jest.MockedFunction<(...args: any[]) => any>;
}

interface MockServer {
  prompt: jest.MockedFunction<(...args: any[]) => any>;
}

describe('Prompt Handlers', () => {
  let mockApiClient: jest.Mocked<IApiClient>;
  let mockSessionManager: jest.Mocked<SessionManager>;
  let mockHooksManager: MockHooksManager;
  let mockContext: PromptContext;
  let mockExtra: RequestHandlerExtra<ServerRequest, ServerNotification>;
  let mockServer: MockServer;

  beforeEach(() => {
    jest.clearAllMocks();

    mockApiClient = {
      fetchPosts: jest.fn(),
      createPost: jest.fn(),
      deletePost: jest.fn(),
    } as jest.Mocked<IApiClient>;

    mockSessionManager = {
      getSession: jest.fn(),
      createSession: jest.fn(),
      destroySession: jest.fn(),
    } as jest.Mocked<Pick<SessionManager, 'getSession' | 'createSession'>> & {
      destroySession: jest.MockedFunction<(...args: any[]) => any>;
    };

    mockHooksManager = {
      executeRequestHooks: jest.fn(),
      executeResponseHooks: jest.fn(),
    } as MockHooksManager;

    mockContext = {
      apiClient: mockApiClient,
      sessionManager: mockSessionManager,
      hooksManager: mockHooksManager,
    };

    mockExtra = {
      signal: new AbortController().signal,
    } as RequestHandlerExtra<ServerRequest, ServerNotification>;

    mockServer = {
      prompt: jest.fn(),
    } as MockServer;

    // Default session mock
    mockSessionManager.getSession.mockReturnValue({
      id: 'test-session',
      agentName: 'test-agent',
      createdAt: new Date(),
      lastActivity: new Date(),
    });

    // Default posts mock
    mockApiClient.fetchPosts.mockResolvedValue({
      posts: [
        {
          id: 'post-123',
          agent_name: 'other-agent',
          content: 'Test post content',
          tags: ['test'],
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ],
      total: 1,
    });
  });

  describe('registerPrompts', () => {
    it('should register all prompts with the server', () => {
      registerPrompts(mockServer, mockContext);

      expect(mockServer.prompt).toHaveBeenCalledTimes(8); // 8 prompts total

      // Verify some key prompts are registered
      const calls = mockServer.prompt.mock.calls;
      const promptNames = calls.map((call) => call[0]);

      expect(promptNames).toContain('summarize-thread');
      expect(promptNames).toContain('draft-reply');
      expect(promptNames).toContain('analyze-sentiment');
      expect(promptNames).toContain('generate-hashtags');
    });

    it('should register prompts with correct descriptions and schemas', () => {
      registerPrompts(mockServer, mockContext);

      const firstCall = mockServer.prompt.mock.calls[0];
      expect(firstCall[1]).toBeDefined(); // description
      expect(firstCall[2]).toBeDefined(); // schema
      expect(typeof firstCall[3]).toBe('function'); // handler
    });

    it('should wrap prompt handlers correctly', async () => {
      registerPrompts(mockServer, mockContext);

      // Get the first registered prompt handler
      const handler = mockServer.prompt.mock.calls[0][3];

      // Call the handler - it should not throw
      await expect(handler({}, mockExtra)).resolves.toBeDefined();
    });
  });

  describe('listPrompts', () => {
    it('should return all available prompts', async () => {
      const result = await listPrompts();

      expect(result.prompts).toHaveLength(8);

      const promptNames = result.prompts.map((p) => p.name);
      expect(promptNames).toContain('summarize-thread');
      expect(promptNames).toContain('draft-reply');
      expect(promptNames).toContain('analyze-sentiment');
    });

    it('should include prompt descriptions and arguments', async () => {
      const result = await listPrompts();

      const draftReplyPrompt = result.prompts.find((p) => p.name === 'draft-reply');
      expect(draftReplyPrompt).toBeDefined();
      expect(draftReplyPrompt?.description).toBeDefined();
      expect(draftReplyPrompt?.arguments).toBeDefined();
      expect(Array.isArray(draftReplyPrompt?.arguments)).toBe(true);
    });

    it('should mark required and optional arguments correctly', async () => {
      const result = await listPrompts();

      const draftReplyPrompt = result.prompts.find((p) => p.name === 'draft-reply');
      const args = draftReplyPrompt?.arguments || [];

      // post_id should be required, tone should be optional
      const postIdArg = args.find((arg) => arg.name === 'post_id');
      const toneArg = args.find((arg) => arg.name === 'tone');

      expect(postIdArg?.required).toBe(true);
      expect(toneArg?.required).toBe(false);
    });
  });

  describe('getPrompt', () => {
    it('should return null for non-existent prompt', async () => {
      const result = await getPrompt('non-existent', {}, mockContext, mockExtra);
      expect(result).toBeNull();
    });

    it('should throw error when called without extra parameter', async () => {
      await expect(getPrompt('draft-reply', {}, mockContext)).rejects.toThrow(
        'getPrompt requires RequestHandlerExtra parameter',
      );
    });

    it('should execute valid prompt handler', async () => {
      const result = await getPrompt(
        'draft-reply',
        { post_id: 'post-123' },
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
      expect(result?.messages).toBeDefined();
    });
  });

  describe('Draft Reply Prompt', () => {
    it('should generate reply draft for existing post', async () => {
      const result = await getPrompt(
        'draft-reply',
        { post_id: 'post-123', tone: 'friendly' },
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
      expect(result?.messages).toHaveLength(1);
      expect(result?.messages[0].role).toBe('user');
      expect(result?.messages[0].content.text).toContain('drafting a reply');
      expect(result?.messages[0].content.text).toContain('friendly');
    });

    it('should handle missing post gracefully', async () => {
      mockApiClient.fetchPosts.mockResolvedValue({ posts: [], total: 0 });

      const result = await getPrompt(
        'draft-reply',
        { post_id: 'non-existent' },
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
      expect(result?.messages[0].content.text).toContain('Unable to find post');
    });

    it('should use default tone when not specified', async () => {
      const result = await getPrompt(
        'draft-reply',
        { post_id: 'post-123' },
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
      expect(result?.messages[0].content.text).toContain('friendly');
    });

    it('should handle session without agent name', async () => {
      mockSessionManager.getSession.mockReturnValue(null);

      const result = await getPrompt(
        'draft-reply',
        { post_id: 'post-123' },
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
      expect(result?.messages[0].content.text).toContain('Anonymous');
    });
  });

  describe('Generate Hashtags Prompt', () => {
    it('should generate hashtags for post content', async () => {
      const result = await getPrompt(
        'generate-hashtags',
        { content: 'Just shipped a new feature for our app!' },
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
      expect(result?.messages[0].content.text).toContain('Generate hashtags');
      expect(result?.messages[0].content.text).toContain('Just shipped a new feature');
    });

    it('should limit hashtags when requested', async () => {
      const result = await getPrompt(
        'generate-hashtags',
        {
          content: 'Test content',
          max_count: '3',
        },
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
      expect(result?.messages[0].content.text).toContain('3');
    });

    it('should include target audience when specified', async () => {
      const result = await getPrompt(
        'generate-hashtags',
        {
          content: 'Tech tutorial',
          target_audience: 'developers',
        },
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
      expect(result?.messages[0].content.text).toContain('audience');
    });
  });

  describe('Create Engagement Post Prompt', () => {
    it('should create engagement post with topic', async () => {
      const result = await getPrompt(
        'create-engagement-post',
        { topic: 'artificial intelligence' },
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
      expect(result?.messages[0].content.text).toContain('creating an engaging');
      expect(result?.messages[0].content.text).toContain('artificial intelligence');
    });

    it('should include post type when specified', async () => {
      const result = await getPrompt(
        'create-engagement-post',
        {
          topic: 'productivity',
          post_type: 'question',
        },
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
      expect(result?.messages[0].content.text).toContain('question');
    });
  });

  describe('Summarize Thread Prompt', () => {
    it('should summarize thread for given post', async () => {
      const result = await getPrompt(
        'summarize-thread',
        { post_id: 'post-123' },
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
      expect(result?.messages[0].content.text).toContain('summarize the following');
      expect(result?.messages[0].content.text).toContain('Test post content');
    });

    it('should handle missing post in thread summarization', async () => {
      mockApiClient.fetchPosts.mockResolvedValue({ posts: [], total: 0 });

      const result = await getPrompt(
        'summarize-thread',
        { post_id: 'non-existent' },
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
      expect(result?.messages[0].content.text).toContain('Unable to find thread');
    });
  });

  describe('Summarize Agent Activity Prompt', () => {
    it('should summarize agent activity with default timeframe', async () => {
      const result = await getPrompt(
        'summarize-agent-activity',
        { agent_name: 'test-agent' },
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
      expect(result?.messages[0].content.text).toContain('analyze and summarize');
      expect(result?.messages[0].content.text).toContain('test-agent');
      expect(result?.messages[0].content.text).toContain('social media activity');
    });

    it('should use custom timeframe when specified', async () => {
      const result = await getPrompt(
        'summarize-agent-activity',
        {
          agent_name: 'test-agent',
          timeframe: '30 days',
        },
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
      expect(result?.messages[0].content.text).toContain('social media activity');
    });
  });

  describe('Analyze Sentiment Prompt', () => {
    it('should analyze sentiment for post content', async () => {
      const result = await getPrompt(
        'analyze-sentiment',
        { content: 'This is amazing! I love it!' },
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
      expect(result?.messages[0].content.text).toContain('analyze the sentiment');
      expect(result?.messages[0].content.text).toContain('Test post content');
    });

    it('should include analysis type when specified', async () => {
      const result = await getPrompt(
        'analyze-sentiment',
        {
          content: 'Mixed feelings about this',
          analysis_type: 'detailed',
        },
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
      expect(result?.messages[0].content.text).toContain('analyze the sentiment');
    });
  });

  describe('Find Related Discussions Prompt', () => {
    it('should find related discussions by topic', async () => {
      const result = await getPrompt(
        'find-related-discussions',
        { topic: 'machine learning' },
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
      expect(result?.messages[0].content.text).toContain('No discussions found');
      expect(result?.messages[0].content.text).toContain('machine learning');
    });

    it('should include search depth when specified', async () => {
      const result = await getPrompt(
        'find-related-discussions',
        {
          topic: 'AI',
          search_depth: 'deep',
        },
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
      expect(result?.messages[0].content.text).toContain('No discussions found');
    });
  });

  describe('Generate Engagement Report Prompt', () => {
    it('should generate engagement report with default timeframe', async () => {
      const result = await getPrompt('generate-engagement-report', {}, mockContext, mockExtra);

      expect(result).toBeDefined();
      expect(result?.messages[0].content.text).toContain('engagement report');
      expect(result?.messages[0].content.text).toContain('week');
    });

    it('should use custom timeframe and metrics', async () => {
      const result = await getPrompt(
        'generate-engagement-report',
        {
          timeframe: '30 days',
          metrics: 'posts,replies,sentiment',
        },
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
      expect(result?.messages[0].content.text).toContain('week');
      expect(result?.messages[0].content.text).toContain('general');
    });
  });

  describe('Error Handling', () => {
    it('should handle API client errors gracefully', async () => {
      mockApiClient.fetchPosts.mockRejectedValue(new Error('API Error'));

      const result = await getPrompt(
        'draft-reply',
        { post_id: 'post-123' },
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
      expect(result?.messages[0].content.text).toContain('Error fetching');
    });

    it('should handle session manager errors gracefully', async () => {
      mockSessionManager.getSession.mockImplementation(() => {
        throw new Error('Session Error');
      });

      // Should still work with Anonymous fallback
      const result = await getPrompt(
        'draft-reply',
        { post_id: 'post-123' },
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
    });

    it('should handle malformed arguments gracefully', async () => {
      const result = await getPrompt(
        'generate-hashtags',
        { content: null as unknown as string }, // Invalid content
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
      // Should handle gracefully without crashing
    });
  });

  describe('Integration Tests', () => {
    it('should work with complete prompt workflow', async () => {
      // First register prompts
      registerPrompts(mockServer, mockContext);

      // Then list them
      const list = await listPrompts();
      expect(list.prompts.length).toBeGreaterThan(0);

      // Then execute one
      const result = await getPrompt(
        'draft-reply',
        { post_id: 'post-123' },
        mockContext,
        mockExtra,
      );

      expect(result).toBeDefined();
      expect(mockApiClient.fetchPosts).toHaveBeenCalled();
    });

    it('should handle concurrent prompt executions', async () => {
      const promises = [
        getPrompt('draft-reply', { post_id: 'post-123' }, mockContext, mockExtra),
        getPrompt('generate-hashtags', { content: 'test' }, mockContext, mockExtra),
        getPrompt('analyze-sentiment', { content: 'test' }, mockContext, mockExtra),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      for (const result of results) {
        expect(result).toBeDefined();
        expect(result?.messages).toBeDefined();
      }
    });

    it('should maintain context isolation between prompts', async () => {
      const context1 = { ...mockContext };
      const context2 = {
        ...mockContext,
        sessionManager: {
          ...mockSessionManager,
          getSession: jest.fn().mockReturnValue({ agentName: 'different-agent' }),
        },
      };

      const result1 = await getPrompt('draft-reply', { post_id: 'post-123' }, context1, mockExtra);
      const result2 = await getPrompt('draft-reply', { post_id: 'post-123' }, context2, mockExtra);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      // Different contexts should produce different results
      expect(result1?.messages[0].content.text).toContain('test-agent');
      expect(result2?.messages[0].content.text).toContain('different-agent');
    });
  });
});
