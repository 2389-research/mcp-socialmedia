// ABOUTME: End-to-end integration tests for complete workflows
// ABOUTME: Tests full agent interactions including login, posting, and replies

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../../src/api-client.js';
import { config } from '../../src/config.js';
import { logger } from '../../src/logger.js';
import { metrics } from '../../src/metrics.js';
import { SessionManager } from '../../src/session-manager.js';
import { createPostToolHandler } from '../../src/tools/create-post.js';
import { loginToolHandler } from '../../src/tools/login.js';
import { readPostsToolHandler } from '../../src/tools/read-posts.js';

describe('End-to-End Integration Tests', () => {
  let sessionManager: SessionManager;
  let apiClient: jest.Mocked<ApiClient>;
  let sessionId: string;
  let mockPosts: Array<{
    id: string;
    content: string;
    author_name: string;
    timestamp: string;
    thread_id?: string;
  }>;
  let postIdCounter: number;
  let networkFailure: boolean;

  beforeEach(() => {
    // Reset environment
    process.env.TEAM_NAME = 'test-team';
    process.env.LOG_LEVEL = 'DEBUG';

    // Initialize state
    mockPosts = [];
    postIdCounter = 0;
    networkFailure = false;

    // Initialize components
    sessionManager = new SessionManager();
    apiClient = {
      fetchPosts: jest.fn(),
      createPost: jest.fn(),
    } as jest.Mocked<ApiClient>;

    // Set up mock responses that simulate a real API with persistent state
    apiClient.fetchPosts.mockImplementation(async (_teamName, options) => {
      if (networkFailure) {
        throw new Error('Network error during validation');
      }

      let filteredPosts = [...mockPosts];

      // Apply filters
      if (options?.agent_filter) {
        filteredPosts = filteredPosts.filter((p) => p.author_name === options.agent_filter);
      }
      if (options?.tag_filter) {
        filteredPosts = filteredPosts.filter((p) => p.tags?.includes(options.tag_filter));
      }
      if (options?.thread_id) {
        // Include the thread root and all replies
        filteredPosts = filteredPosts.filter(
          (p) => p.id === options.thread_id || p.parent_post_id === options.thread_id,
        );
      }

      const limit = options?.limit || 10;
      const offset = options?.offset || 0;
      const paginatedPosts = filteredPosts.slice(offset, offset + limit);

      return {
        posts: paginatedPosts,
        total: filteredPosts.length,
        has_more: offset + limit < filteredPosts.length,
      };
    });

    apiClient.createPost.mockImplementation(async (teamName, postData) => {
      if (networkFailure) {
        throw new Error('Network error');
      }

      const newPost = {
        id: `post-${Date.now()}-${++postIdCounter}`,
        team_name: teamName,
        author_name: postData.author_name,
        content: postData.content,
        tags: postData.tags || [],
        timestamp: new Date().toISOString(),
        parent_post_id: postData.parent_post_id,
        deleted: false,
      };

      // Add to mock posts array to simulate persistence
      mockPosts.push(newPost);

      return { post: newPost };
    });

    sessionId = `test-session-${Date.now()}`;

    // Reset metrics
    metrics.reset();
  });

  afterEach(async () => {
    // Clean up
    await sessionManager.clearAllSessions();
  });

  describe('Complete Agent Workflow', () => {
    it('should handle complete workflow: login → read → create → read updated', async () => {
      logger.info('Starting complete agent workflow test');

      // Step 1: Login
      const loginContext = {
        sessionManager,
        getSessionId: () => sessionId,
      };

      const loginResult = await loginToolHandler({ agent_name: 'test-agent' }, loginContext);

      const loginResponse = JSON.parse(loginResult.content[0].text);
      expect(loginResponse.success).toBe(true);
      expect(loginResponse.agent_name).toBe('test-agent');
      expect(loginResponse.team_name).toBe(config.teamName);
      logger.info('Login successful', { agent_name: 'test-agent' });

      // Step 2: Read initial posts
      const readContext = {
        apiClient,
      };

      const initialReadResult = await readPostsToolHandler({}, readContext);
      const initialPosts = JSON.parse(initialReadResult.content[0].text);
      expect(initialPosts.posts).toBeDefined();
      const initialPostCount = initialPosts.posts.length;
      logger.info('Initial post count', { count: initialPostCount });

      // Step 3: Create a new post
      const createContext = {
        sessionManager,
        apiClient,
        getSessionId: () => sessionId,
      };

      const createResult = await createPostToolHandler(
        {
          content: 'Integration test post',
          tags: ['test', 'integration'],
        },
        createContext,
      );

      const createResponse = JSON.parse(createResult.content[0].text);
      expect(createResponse.success).toBe(true);
      expect(createResponse.post).toBeDefined();
      expect(createResponse.post.team_name).toBe(config.teamName);
      const newPostId = createResponse.post.id;
      logger.info('Post created', { postId: newPostId });

      // Step 4: Read updated feed
      const updatedReadResult = await readPostsToolHandler({}, readContext);
      const updatedPosts = JSON.parse(updatedReadResult.content[0].text);
      expect(updatedPosts.posts.length).toBe(initialPostCount + 1);

      // Verify our post is in the feed
      const ourPost = updatedPosts.posts.find((p: { id: string }) => p.id === newPostId);
      expect(ourPost).toBeDefined();
      expect(ourPost.content).toBe('Integration test post');
      expect(ourPost.author_name).toBe('test-agent');
      expect(ourPost.team_name).toBe(config.teamName);
      logger.info('Post verified in feed');
    });
  });

  describe('Reply Workflow', () => {
    it('should handle reply workflow: login → read → create reply → verify threading', async () => {
      logger.info('Starting reply workflow test');

      // Setup: Add a parent post to mock posts array
      const parentPost = {
        id: 'parent-post-integration',
        team_name: config.teamName,
        author_name: 'other-agent',
        content: 'Parent post for replies',
        tags: ['discussion'],
        timestamp: new Date().toISOString(),
      };
      mockPosts.push(parentPost);

      // Step 1: Login
      const loginContext = {
        sessionManager,
        getSessionId: () => sessionId,
      };

      await loginToolHandler({ agent_name: 'reply-agent' }, loginContext);

      // Step 2: Read posts to find parent
      const readContext = {
        apiClient,
      };

      const readResult = await readPostsToolHandler({}, readContext);
      const posts = JSON.parse(readResult.content[0].text);
      const foundParent = posts.posts.find((p: { id: string }) => p.id === parentPost.id);
      expect(foundParent).toBeDefined();

      // Step 3: Create reply
      const createContext = {
        sessionManager,
        apiClient,
        getSessionId: () => sessionId,
      };

      const replyResult = await createPostToolHandler(
        {
          content: 'This is a reply to the parent post',
          parent_post_id: parentPost.id,
        },
        createContext,
      );

      const replyResponse = JSON.parse(replyResult.content[0].text);
      expect(replyResponse.success).toBe(true);
      expect(replyResponse.post.parent_post_id).toBe(parentPost.id);
      const replyId = replyResponse.post.id;

      // Step 4: Verify threading with thread_id filter
      const threadResult = await readPostsToolHandler({ thread_id: parentPost.id }, readContext);

      const threadPosts = JSON.parse(threadResult.content[0].text);
      expect(threadPosts.posts.length).toBeGreaterThanOrEqual(2);

      // Should include both parent and reply
      const hasParent = threadPosts.posts.some((p: { id: string }) => p.id === parentPost.id);
      const hasReply = threadPosts.posts.some((p: { id: string }) => p.id === replyId);
      expect(hasParent).toBe(true);
      expect(hasReply).toBe(true);

      logger.info('Reply thread verified', {
        parentId: parentPost.id,
        replyId,
        threadSize: threadPosts.posts.length,
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should handle API failures gracefully', async () => {
      logger.info('Testing API failure handling');

      // Login first
      const loginContext = {
        sessionManager,
        getSessionId: () => sessionId,
      };
      await loginToolHandler({ agent_name: 'error-test-agent' }, loginContext);

      // Simulate API failure
      networkFailure = true;

      // Try to create post
      const createContext = {
        sessionManager,
        apiClient,
        getSessionId: () => sessionId,
      };

      const result = await createPostToolHandler({ content: 'This should fail' }, createContext);

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Failed to create post');
      logger.warn('API failure handled correctly');

      // Reset API
      networkFailure = false;
    });

    it('should enforce session requirements', async () => {
      logger.info('Testing session validation');

      // Try to create post without login
      const createContext = {
        sessionManager,
        apiClient,
        getSessionId: () => 'no-session',
      };

      const result = await createPostToolHandler({ content: 'Unauthorized post' }, createContext);

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Authentication required');
      logger.info('Session validation working correctly');
    });
  });

  describe('Multi-Agent Scenarios', () => {
    it('should handle multiple agents posting and reading', async () => {
      logger.info('Testing multi-agent scenario');

      const agents = ['alice', 'bob', 'charlie'];
      const sessions: Record<string, string> = {};

      // All agents login
      for (const agent of agents) {
        const agentSessionId = `session-${agent}`;
        sessions[agent] = agentSessionId;

        const loginContext = {
          sessionManager,
          getSessionId: () => agentSessionId,
        };

        await loginToolHandler({ agent_name: agent }, loginContext);
        logger.debug(`Agent ${agent} logged in`);
      }

      // Each agent creates a post
      const postIds: string[] = [];
      for (const agent of agents) {
        const createContext = {
          sessionManager,
          apiClient,
          getSessionId: () => sessions[agent],
        };

        const result = await createPostToolHandler(
          {
            content: `Post from ${agent}`,
            tags: [agent, 'multi-agent-test'],
          },
          createContext,
        );

        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(true);
        expect(response.post.team_name).toBe(config.teamName);
        postIds.push(response.post.id);
        logger.debug(`Agent ${agent} created post ${response.post.id}`);
      }

      // Read all posts with agent filter
      const readContext = {
        apiClient,
      };

      for (const agent of agents) {
        const result = await readPostsToolHandler({ agent_filter: agent }, readContext);

        const response = JSON.parse(result.content[0].text);
        const agentPosts = response.posts.filter(
          (p: { author_name: string }) => p.author_name === agent,
        );
        expect(agentPosts.length).toBeGreaterThanOrEqual(1);
        logger.debug(`Found ${agentPosts.length} posts by ${agent}`);
      }

      // Create a conversation thread
      const alicePost = postIds[0];

      // Bob replies to Alice
      const bobReplyContext = {
        sessionManager,
        apiClient,
        getSessionId: () => sessions.bob,
      };

      const bobReply = await createPostToolHandler(
        {
          content: 'Reply from Bob to Alice',
          parent_post_id: alicePost,
        },
        bobReplyContext,
      );

      const bobReplyResponse = JSON.parse(bobReply.content[0].text);
      expect(bobReplyResponse.success).toBe(true);

      // Charlie replies to Bob's reply
      const charlieReplyContext = {
        sessionManager,
        apiClient,
        getSessionId: () => sessions.charlie,
      };

      const charlieReply = await createPostToolHandler(
        {
          content: 'Reply from Charlie to Bob',
          parent_post_id: bobReplyResponse.post.id,
        },
        charlieReplyContext,
      );

      const charlieReplyResponse = JSON.parse(charlieReply.content[0].text);
      expect(charlieReplyResponse.success).toBe(true);

      logger.info('Multi-agent conversation created successfully');
    });
  });

  describe('Performance Monitoring', () => {
    it('should track operation metrics', async () => {
      logger.info('Testing performance monitoring');

      // Reset metrics to ensure clean state
      metrics.reset();

      // Perform several operations
      const loginContext = {
        sessionManager,
        getSessionId: () => sessionId,
      };

      // Login - the handler already tracks metrics internally
      await loginToolHandler({ agent_name: 'metrics-agent' }, loginContext);

      // Create posts
      const createContext = {
        sessionManager,
        apiClient,
        getSessionId: () => sessionId,
      };

      for (let i = 0; i < 5; i++) {
        await createPostToolHandler({ content: `Performance test post ${i}` }, createContext);
      }

      // Read posts
      const readContext = {
        apiClient,
      };

      await readPostsToolHandler({ limit: 20 }, readContext);

      // Check metrics
      const loginMetrics = metrics.getOperationMetrics('login');
      expect(loginMetrics).toBeDefined();
      expect(loginMetrics?.count).toBe(1);
      expect(loginMetrics?.errors).toBe(0);

      const systemMetrics = metrics.getSystemMetrics();
      expect(systemMetrics.uptime).toBeGreaterThanOrEqual(0);
      expect(systemMetrics.memoryUsage).toBeDefined();
      expect(systemMetrics.memoryUsage.rss).toBeGreaterThan(0);

      logger.info(`Metrics summary:\n${metrics.getSummary()}`);
    });
  });
});
