// ABOUTME: Tests for the read posts tool functionality
// ABOUTME: Validates post retrieval, pagination, and error handling

import { jest } from '@jest/globals';
import type { ApiClient } from '../../src/api-client';
import { config } from '../../src/config';
import { type ReadPostsToolContext, readPostsToolHandler } from '../../src/tools/read-posts';
import { Post, type ReadPostsToolResponse } from '../../src/types';

describe('Read Posts Tool', () => {
  let mockApiClient: jest.Mocked<ApiClient>;
  let context: ReadPostsToolContext;

  beforeEach(() => {
    // Set up environment
    process.env.TEAM_NAME = config.teamName;

    mockApiClient = {
      fetchPosts: jest.fn(),
      createPost: jest.fn(),
    } as jest.Mocked<ApiClient>;
    context = {
      apiClient: mockApiClient,
    };

    // Set up default mock response
    mockApiClient.fetchPosts.mockResolvedValue({
      posts: [
        {
          id: 'post-1',
          team_name: config.teamName,
          author_name: 'test-user',
          content: 'Test post content',
          tags: ['test'],
          timestamp: '2023-01-01T00:00:00Z',
          deleted: false,
        },
      ],
      total: 1,
      has_more: false,
    });
  });

  describe('Successful post retrieval', () => {
    it('should fetch posts with default parameters', async () => {
      const result = await readPostsToolHandler({}, context);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.posts).toBeDefined();
        expect(Array.isArray(response.posts)).toBe(true);
        expect(response.posts.length).toBeGreaterThan(0);
        expect(response.limit).toBe(10);
        expect(response.offset).toBe(0);
        expect('error' in response).toBe(false);
      }
    });

    it('should fetch posts with custom limit', async () => {
      const result = await readPostsToolHandler({ limit: 5 }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.posts.length).toBeLessThanOrEqual(5);
        expect(response.limit).toBe(5);
        expect(response.offset).toBe(0);
      }
    });

    it('should fetch posts with custom offset', async () => {
      const result = await readPostsToolHandler({ offset: 2 }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.posts).toBeDefined();
        expect(response.limit).toBe(10);
        expect(response.offset).toBe(2);
      }
    });

    it('should fetch posts with both limit and offset', async () => {
      const result = await readPostsToolHandler({ limit: 3, offset: 1 }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.posts).toBeDefined();
        expect(response.limit).toBe(3);
        expect(response.offset).toBe(1);
      }
    });

    it('should return posts with correct structure', async () => {
      const result = await readPostsToolHandler({}, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      if (!response.success) return;
      const posts = response.posts;

      expect(posts.length).toBeGreaterThan(0);

      const post = posts[0];
      expect(post).toHaveProperty('id');
      expect(post).toHaveProperty('team_name');
      expect(post).toHaveProperty('author_name');
      expect(post).toHaveProperty('content');
      expect(post).toHaveProperty('tags');
      expect(post).toHaveProperty('timestamp');
      // parent_post_id is optional
    });
  });

  describe('Pagination', () => {
    it('should handle pagination correctly', async () => {
      // Mock different responses for different pages
      mockApiClient.fetchPosts
        .mockResolvedValueOnce({
          posts: [
            {
              id: 'post-page1-1',
              team_name: config.teamName,
              author_name: 'user1',
              content: 'Page 1 post 1',
              tags: ['page1'],
              timestamp: '2023-01-01T00:00:00Z',
            },
            {
              id: 'post-page1-2',
              team_name: config.teamName,
              author_name: 'user2',
              content: 'Page 1 post 2',
              tags: ['page1'],
              timestamp: '2023-01-01T01:00:00Z',
            },
          ],
          total: 4,
          has_more: true,
        })
        .mockResolvedValueOnce({
          posts: [
            {
              id: 'post-page2-1',
              team_name: config.teamName,
              author_name: 'user3',
              content: 'Page 2 post 1',
              tags: ['page2'],
              timestamp: '2023-01-01T02:00:00Z',
            },
            {
              id: 'post-page2-2',
              team_name: config.teamName,
              author_name: 'user4',
              content: 'Page 2 post 2',
              tags: ['page2'],
              timestamp: '2023-01-01T03:00:00Z',
            },
          ],
          total: 4,
          has_more: false,
        });

      // Get first page
      const page1Result = await readPostsToolHandler({ limit: 2, offset: 0 }, context);
      const page1Response: ReadPostsToolResponse = JSON.parse(page1Result.content[0].text);

      // Get second page
      const page2Result = await readPostsToolHandler({ limit: 2, offset: 2 }, context);
      const page2Response: ReadPostsToolResponse = JSON.parse(page2Result.content[0].text);

      // Verify different posts
      if (page1Response.success && page2Response.success) {
        expect(page1Response.posts[0].id).not.toBe(page2Response.posts[0]?.id);
      }
    });

    it('should handle large offset values', async () => {
      // Mock empty response for large offset
      mockApiClient.fetchPosts.mockResolvedValueOnce({
        posts: [],
        total: 0,
        has_more: false,
      });

      const result = await readPostsToolHandler({ offset: 1000 }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.posts).toBeDefined();
        expect(response.posts.length).toBe(0); // No posts at such high offset
        expect('error' in response).toBe(false);
      }
    });

    it('should handle limit edge cases', async () => {
      // Minimum limit
      const minResult = await readPostsToolHandler({ limit: 1 }, context);
      const minResponse: ReadPostsToolResponse = JSON.parse(minResult.content[0].text);
      expect(minResponse.success).toBe(true);
      if (minResponse.success) {
        expect(minResponse.posts.length).toBe(1);
      }

      // Maximum reasonable limit
      const maxResult = await readPostsToolHandler({ limit: 100 }, context);
      const maxResponse: ReadPostsToolResponse = JSON.parse(maxResult.content[0].text);
      expect(maxResponse.success).toBe(true);
      if (maxResponse.success) {
        expect(maxResponse.posts).toBeDefined();
        expect(maxResponse.limit).toBe(100);
      }
    });
  });

  describe('Empty results', () => {
    it('should handle empty post list gracefully', async () => {
      // Mock empty response
      mockApiClient.fetchPosts.mockResolvedValueOnce({
        posts: [],
        total: 0,
        has_more: false,
      });

      const result = await readPostsToolHandler({}, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.posts).toEqual([]);
        expect('error' in response).toBe(false);
        expect(response.limit).toBe(10);
        expect(response.offset).toBe(0);
      }
    });

    it('should handle team with no posts gracefully', async () => {
      // Mock empty response for test-team (no posts)
      mockApiClient.fetchPosts.mockResolvedValueOnce({
        posts: [],
        total: 0,
        has_more: false,
      });

      const result = await readPostsToolHandler({}, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.posts).toEqual([]);
        expect('error' in response).toBe(false);
      }
    });
  });

  describe('Error handling', () => {
    it('should handle API authentication failure', async () => {
      mockApiClient.fetchPosts.mockRejectedValueOnce(
        new Error('Authentication failed: Invalid API key'),
      );

      const result = await readPostsToolHandler({}, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error).toContain('Authentication failed');
        // Error responses should NOT have these fields
        expect('posts' in response).toBe(false);
        expect('limit' in response).toBe(false);
        expect('offset' in response).toBe(false);
        expect('total' in response).toBe(false);
        expect('has_more' in response).toBe(false);
      }
    });

    it('should handle network errors', async () => {
      mockApiClient.fetchPosts.mockRejectedValueOnce(new Error('Network error: Failed to fetch'));

      const result = await readPostsToolHandler({}, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error).toContain('Network error');
        expect('posts' in response).toBe(false);
        expect('limit' in response).toBe(false);
        expect('offset' in response).toBe(false);
      }
    });

    it('should handle API timeout', async () => {
      mockApiClient.fetchPosts.mockRejectedValueOnce(new Error('Request timeout after 30000ms'));

      const result = await readPostsToolHandler({}, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error).toContain('Request timeout');
        expect('posts' in response).toBe(false);
        expect('limit' in response).toBe(false);
        expect('offset' in response).toBe(false);
      }
    });

    it('should handle unexpected errors', async () => {
      // Mock fetchPosts to throw unexpected error
      jest.spyOn(mockApiClient, 'fetchPosts').mockRejectedValueOnce(new Error('Unexpected error'));

      const result = await readPostsToolHandler({}, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error).toBe('Unexpected error');
        expect('posts' in response).toBe(false);
        expect('limit' in response).toBe(false);
        expect('offset' in response).toBe(false);
      }
    });
  });

  describe('Response format', () => {
    it('should always return MCP-compliant response structure', async () => {
      const result = await readPostsToolHandler({}, context);

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
      expect(typeof result.content[0].text).toBe('string');

      // Verify JSON is valid
      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });

    it('should include all fields in successful response', async () => {
      const result = await readPostsToolHandler({ limit: 5, offset: 2 }, context);
      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response).toHaveProperty('posts');
        expect(response).toHaveProperty('limit', 5);
        expect(response).toHaveProperty('offset', 2);
        expect(response).not.toHaveProperty('error');
      }
    });

    it('should include error field in failure response', async () => {
      mockApiClient.fetchPosts.mockRejectedValueOnce(
        new Error('Authentication failed: Invalid API key'),
      );

      const result = await readPostsToolHandler({}, context);
      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response).toHaveProperty('error');
        expect(response).toHaveProperty('success', false);
        // Error responses should NOT have these fields
        expect(response).not.toHaveProperty('posts');
        expect(response).not.toHaveProperty('limit');
        expect(response).not.toHaveProperty('offset');
        expect(response).not.toHaveProperty('total');
        expect(response).not.toHaveProperty('has_more');
      }
    });
  });

  describe('Integration with team configuration', () => {
    it('should use team name from configuration', async () => {
      const fetchPostsSpy = jest.spyOn(mockApiClient, 'fetchPosts');

      await readPostsToolHandler({}, context);

      expect(fetchPostsSpy).toHaveBeenCalledWith(config.teamName, expect.any(Object));
    });

    it('should pass correct options to API client', async () => {
      const fetchPostsSpy = jest.spyOn(mockApiClient, 'fetchPosts');

      await readPostsToolHandler({ limit: 15, offset: 5 }, context);

      expect(fetchPostsSpy).toHaveBeenCalledWith(config.teamName, {
        limit: 15,
        offset: 5,
        agent_filter: undefined,
        tag_filter: undefined,
        thread_id: undefined,
      });
    });
  });

  describe('Filtering functionality', () => {
    it('should filter posts by agent name', async () => {
      // Mock response with posts from agent-alice
      mockApiClient.fetchPosts.mockResolvedValueOnce({
        posts: [
          {
            id: 'alice-post-1',
            team_name: config.teamName,
            author_name: 'agent-alice',
            content: 'Post by Alice',
            tags: ['alice'],
            timestamp: '2023-01-01T00:00:00Z',
          },
        ],
        total: 1,
        has_more: false,
      });

      const result = await readPostsToolHandler({ agent_filter: 'agent-alice' }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.posts).toBeDefined();
        expect(response.posts.length).toBeGreaterThan(0);
        expect(response.posts.every((post) => post.author_name === 'agent-alice')).toBe(true);
      }
    });

    it('should filter posts by tag', async () => {
      // Mock response with posts tagged 'update'
      mockApiClient.fetchPosts.mockResolvedValueOnce({
        posts: [
          {
            id: 'update-post-1',
            team_name: config.teamName,
            author_name: 'user1',
            content: 'Update post',
            tags: ['update', 'news'],
            timestamp: '2023-01-01T00:00:00Z',
          },
        ],
        total: 1,
        has_more: false,
      });

      const result = await readPostsToolHandler({ tag_filter: 'update' }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.posts).toBeDefined();
        expect(response.posts.length).toBeGreaterThan(0);
        expect(response.posts.every((post) => post.tags.includes('update'))).toBe(true);
      }
    });

    it('should filter posts by thread ID', async () => {
      // Mock response with thread posts
      mockApiClient.fetchPosts.mockResolvedValueOnce({
        posts: [
          {
            id: 'post-seed-2',
            team_name: config.teamName,
            author_name: 'user1',
            content: 'Thread root',
            tags: ['thread'],
            timestamp: '2023-01-01T00:00:00Z',
          },
          {
            id: 'reply-1',
            team_name: config.teamName,
            author_name: 'user2',
            content: 'Reply to thread',
            tags: ['reply'],
            timestamp: '2023-01-01T01:00:00Z',
            parent_post_id: 'post-seed-2',
          },
        ],
        total: 2,
        has_more: false,
      });

      const result = await readPostsToolHandler({ thread_id: 'post-seed-2' }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.posts).toBeDefined();
        expect(response.posts.length).toBeGreaterThan(0);

        // Should include the thread parent and its replies
        const postIds = response.posts.map((p) => p.id);
        expect(postIds).toContain('post-seed-2');
        const hasReply = response.posts.some((p) => p.parent_post_id === 'post-seed-2');
        expect(hasReply).toBe(true);
      }
    });

    it('should support combined filters', async () => {
      // Mock response for combined filters
      mockApiClient.fetchPosts.mockResolvedValueOnce({
        posts: [
          {
            id: 'alice-update-1',
            team_name: config.teamName,
            author_name: 'agent-alice',
            content: 'Alice update post',
            tags: ['update', 'alice'],
            timestamp: '2023-01-01T00:00:00Z',
          },
        ],
        total: 1,
        has_more: false,
      });

      const result = await readPostsToolHandler(
        {
          agent_filter: 'agent-alice',
          tag_filter: 'update',
          limit: 5,
        },
        context,
      );

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.posts).toBeDefined();
        expect(
          response.posts.every(
            (post) => post.author_name === 'agent-alice' && post.tags.includes('update'),
          ),
        ).toBe(true);
        expect(response.limit).toBe(5);
      }
    });

    it('should handle filters with no matching posts', async () => {
      // Mock empty response for non-matching filter
      mockApiClient.fetchPosts.mockResolvedValueOnce({
        posts: [],
        total: 0,
        has_more: false,
      });

      const result = await readPostsToolHandler({ agent_filter: 'non-existent-agent' }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.posts).toEqual([]);
        expect('error' in response).toBe(false);
      }
    });

    it('should trim filter values', async () => {
      const fetchPostsSpy = jest.spyOn(mockApiClient, 'fetchPosts');

      await readPostsToolHandler(
        {
          agent_filter: '  agent-alice  ',
          tag_filter: ' update ',
          thread_id: ' post-seed-2 ',
        },
        context,
      );

      expect(fetchPostsSpy).toHaveBeenCalledWith(config.teamName, {
        limit: 10,
        offset: 0,
        agent_filter: 'agent-alice',
        tag_filter: 'update',
        thread_id: 'post-seed-2',
      });
    });
  });

  describe('Parameter validation', () => {
    it('should reject empty agent_filter', async () => {
      const result = await readPostsToolHandler({ agent_filter: '' }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error).toContain('agent_filter cannot be empty');
        expect('posts' in response).toBe(false);
        expect('limit' in response).toBe(false);
        expect('offset' in response).toBe(false);
      }
    });

    it('should reject empty tag_filter', async () => {
      const result = await readPostsToolHandler({ tag_filter: '   ' }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error).toContain('tag_filter cannot be empty');
        expect('posts' in response).toBe(false);
        expect('limit' in response).toBe(false);
        expect('offset' in response).toBe(false);
      }
    });

    it('should reject empty thread_id', async () => {
      const result = await readPostsToolHandler({ thread_id: '' }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error).toContain('thread_id cannot be empty');
        expect('posts' in response).toBe(false);
        expect('limit' in response).toBe(false);
        expect('offset' in response).toBe(false);
      }
    });

    it('should allow undefined filters', async () => {
      const result = await readPostsToolHandler(
        {
          agent_filter: undefined,
          tag_filter: undefined,
          thread_id: undefined,
        },
        context,
      );

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.posts).toBeDefined();
        expect('error' in response).toBe(false);
      }
    });
  });

  describe('Complex filtering scenarios', () => {
    it('should handle pagination with filters', async () => {
      // Mock different pages of alice's posts
      mockApiClient.fetchPosts
        .mockResolvedValueOnce({
          posts: [
            {
              id: 'alice-page1',
              team_name: config.teamName,
              author_name: 'agent-alice',
              content: 'Alice post 1',
              tags: ['alice'],
              timestamp: '2023-01-01T00:00:00Z',
            },
          ],
          total: 2,
          has_more: true,
        })
        .mockResolvedValueOnce({
          posts: [
            {
              id: 'alice-page2',
              team_name: config.teamName,
              author_name: 'agent-alice',
              content: 'Alice post 2',
              tags: ['alice'],
              timestamp: '2023-01-01T01:00:00Z',
            },
          ],
          total: 2,
          has_more: false,
        });

      // Get first page of alice's posts
      const page1 = await readPostsToolHandler(
        {
          agent_filter: 'agent-alice',
          limit: 1,
          offset: 0,
        },
        context,
      );

      // Get second page
      const page2 = await readPostsToolHandler(
        {
          agent_filter: 'agent-alice',
          limit: 1,
          offset: 1,
        },
        context,
      );

      const response1: ReadPostsToolResponse = JSON.parse(page1.content[0].text);
      const response2: ReadPostsToolResponse = JSON.parse(page2.content[0].text);

      // Should get different posts
      if (
        response1.success &&
        response2.success &&
        response1.posts.length > 0 &&
        response2.posts.length > 0
      ) {
        expect(response1.posts[0].id).not.toBe(response2.posts[0].id);
      }
    });

    it('should handle multiple tags correctly', async () => {
      // Mock response with multi-tag post
      mockApiClient.fetchPosts.mockResolvedValueOnce({
        posts: [
          {
            id: 'multi-tag-post',
            team_name: config.teamName,
            author_name: 'agent-test',
            content: 'Post with multiple tags',
            tags: ['development', 'update', 'feature'],
            timestamp: new Date().toISOString(),
            deleted: false,
          },
        ],
        total: 1,
        has_more: false,
      });

      // Should find the post when filtering by any of its tags
      const result = await readPostsToolHandler({ tag_filter: 'feature' }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      if (response.success) {
        const multiTagPost = response.posts.find((p) => p.id === 'multi-tag-post');
        expect(multiTagPost).toBeDefined();
      }
    });

    it('should call API with thread_id parameter', async () => {
      const rootId = 'thread-root';

      await readPostsToolHandler({ thread_id: rootId }, context);

      expect(mockApiClient.fetchPosts).toHaveBeenCalledWith(config.teamName, {
        limit: 10,
        offset: 0,
        thread_id: rootId,
      });
    });
  });
});
