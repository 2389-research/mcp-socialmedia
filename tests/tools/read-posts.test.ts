// ABOUTME: Tests for the read posts tool functionality
// ABOUTME: Validates post retrieval, pagination, and error handling

import { jest } from '@jest/globals';
import { readPostsToolHandler, ReadPostsToolContext } from '../../src/tools/read-posts';
import { MockApiClient } from '../../src/mock-api-client';
import { ReadPostsToolResponse, Post } from '../../src/types';

describe('Read Posts Tool', () => {
  let mockApiClient: MockApiClient;
  let context: ReadPostsToolContext;

  beforeEach(() => {
    // Set up environment
    process.env.TEAM_NAME = 'test-team';

    mockApiClient = new MockApiClient();
    context = {
      apiClient: mockApiClient,
    };
  });

  describe('Successful post retrieval', () => {
    it('should fetch posts with default parameters', async () => {
      const result = await readPostsToolHandler({}, context);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.posts).toBeDefined();
      expect(Array.isArray(response.posts)).toBe(true);
      expect(response.posts?.length).toBeGreaterThan(0);
      expect(response.limit).toBe(10);
      expect(response.offset).toBe(0);
      expect(response.error).toBeUndefined();
    });

    it('should fetch posts with custom limit', async () => {
      const result = await readPostsToolHandler({ limit: 5 }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.posts?.length).toBeLessThanOrEqual(5);
      expect(response.limit).toBe(5);
      expect(response.offset).toBe(0);
    });

    it('should fetch posts with custom offset', async () => {
      const result = await readPostsToolHandler({ offset: 2 }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.posts).toBeDefined();
      expect(response.limit).toBe(10);
      expect(response.offset).toBe(2);
    });

    it('should fetch posts with both limit and offset', async () => {
      const result = await readPostsToolHandler({ limit: 3, offset: 1 }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.posts).toBeDefined();
      expect(response.limit).toBe(3);
      expect(response.offset).toBe(1);
    });

    it('should return posts with correct structure', async () => {
      const result = await readPostsToolHandler({}, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      const posts = response.posts!;

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
      // Get first page
      const page1Result = await readPostsToolHandler({ limit: 2, offset: 0 }, context);
      const page1Response: ReadPostsToolResponse = JSON.parse(page1Result.content[0].text);

      // Get second page
      const page2Result = await readPostsToolHandler({ limit: 2, offset: 2 }, context);
      const page2Response: ReadPostsToolResponse = JSON.parse(page2Result.content[0].text);

      // Verify different posts
      expect(page1Response.posts![0].id).not.toBe(page2Response.posts![0]?.id);
    });

    it('should handle large offset values', async () => {
      const result = await readPostsToolHandler({ offset: 1000 }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.posts).toBeDefined();
      expect(response.posts?.length).toBe(0); // No posts at such high offset
      expect(response.error).toBeUndefined();
    });

    it('should handle limit edge cases', async () => {
      // Minimum limit
      const minResult = await readPostsToolHandler({ limit: 1 }, context);
      const minResponse: ReadPostsToolResponse = JSON.parse(minResult.content[0].text);
      expect(minResponse.posts?.length).toBe(1);

      // Maximum reasonable limit
      const maxResult = await readPostsToolHandler({ limit: 100 }, context);
      const maxResponse: ReadPostsToolResponse = JSON.parse(maxResult.content[0].text);
      expect(maxResponse.posts).toBeDefined();
      expect(maxResponse.limit).toBe(100);
    });
  });

  describe('Empty results', () => {
    it('should handle empty post list gracefully', async () => {
      // Clear all posts
      mockApiClient.clearPosts();

      const result = await readPostsToolHandler({}, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.posts).toEqual([]);
      expect(response.error).toBeUndefined();
      expect(response.limit).toBe(10);
      expect(response.offset).toBe(0);
    });

    it('should handle team with no posts gracefully', async () => {
      // Clear all posts and add one for a different team
      mockApiClient.clearPosts();
      mockApiClient.addPost({
        id: 'other-team-post',
        team_name: 'other-team',
        author_name: 'other-agent',
        content: 'Post from another team',
        tags: [],
        timestamp: new Date().toISOString(),
      });

      const result = await readPostsToolHandler({}, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.posts).toEqual([]);
      expect(response.error).toBeUndefined();
    });
  });

  describe('Error handling', () => {
    it('should handle API authentication failure', async () => {
      mockApiClient.setAuthFailure(true);

      const result = await readPostsToolHandler({}, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.posts).toEqual([]);
      expect(response.error).toContain('Authentication failed');
      expect(response.limit).toBe(10);
      expect(response.offset).toBe(0);
    });

    it('should handle network errors', async () => {
      mockApiClient.setNetworkFailure(true);

      const result = await readPostsToolHandler({}, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.posts).toEqual([]);
      expect(response.error).toContain('Network error');
    });

    it('should handle API timeout', async () => {
      mockApiClient.setTimeout(true);

      const result = await readPostsToolHandler({}, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.posts).toEqual([]);
      expect(response.error).toContain('Request timeout');
    });

    it('should handle unexpected errors', async () => {
      // Mock fetchPosts to throw unexpected error
      jest.spyOn(mockApiClient, 'fetchPosts').mockRejectedValueOnce(new Error('Unexpected error'));

      const result = await readPostsToolHandler({}, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.posts).toEqual([]);
      expect(response.error).toBe('Unexpected error');
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

      expect(response).toHaveProperty('posts');
      expect(response).toHaveProperty('limit', 5);
      expect(response).toHaveProperty('offset', 2);
      expect(response).not.toHaveProperty('error');
    });

    it('should include error field in failure response', async () => {
      mockApiClient.setAuthFailure(true);

      const result = await readPostsToolHandler({}, context);
      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);

      expect(response).toHaveProperty('posts', []);
      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('limit');
      expect(response).toHaveProperty('offset');
    });
  });

  describe('Integration with team configuration', () => {
    it('should use team name from configuration', async () => {
      const fetchPostsSpy = jest.spyOn(mockApiClient, 'fetchPosts');

      await readPostsToolHandler({}, context);

      expect(fetchPostsSpy).toHaveBeenCalledWith('test-team', expect.any(Object));
    });

    it('should pass correct options to API client', async () => {
      const fetchPostsSpy = jest.spyOn(mockApiClient, 'fetchPosts');

      await readPostsToolHandler({ limit: 15, offset: 5 }, context);

      expect(fetchPostsSpy).toHaveBeenCalledWith('test-team', {
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
      const result = await readPostsToolHandler({ agent_filter: 'agent-alice' }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.posts).toBeDefined();
      expect(response.posts!.length).toBeGreaterThan(0);
      expect(response.posts!.every((post) => post.author_name === 'agent-alice')).toBe(true);
    });

    it('should filter posts by tag', async () => {
      const result = await readPostsToolHandler({ tag_filter: 'update' }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.posts).toBeDefined();
      expect(response.posts!.length).toBeGreaterThan(0);
      expect(response.posts!.every((post) => post.tags.includes('update'))).toBe(true);
    });

    it('should filter posts by thread ID', async () => {
      const result = await readPostsToolHandler({ thread_id: 'post-seed-2' }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.posts).toBeDefined();
      expect(response.posts!.length).toBeGreaterThan(0);

      // Should include the thread parent and its replies
      const postIds = response.posts!.map((p) => p.id);
      expect(postIds).toContain('post-seed-2');
      const hasReply = response.posts!.some((p) => p.parent_post_id === 'post-seed-2');
      expect(hasReply).toBe(true);
    });

    it('should support combined filters', async () => {
      const result = await readPostsToolHandler(
        {
          agent_filter: 'agent-alice',
          tag_filter: 'update',
          limit: 5,
        },
        context
      );

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.posts).toBeDefined();
      expect(
        response.posts!.every(
          (post) => post.author_name === 'agent-alice' && post.tags.includes('update')
        )
      ).toBe(true);
      expect(response.limit).toBe(5);
    });

    it('should handle filters with no matching posts', async () => {
      const result = await readPostsToolHandler({ agent_filter: 'non-existent-agent' }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.posts).toEqual([]);
      expect(response.error).toBeUndefined();
    });

    it('should trim filter values', async () => {
      const fetchPostsSpy = jest.spyOn(mockApiClient, 'fetchPosts');

      await readPostsToolHandler(
        {
          agent_filter: '  agent-alice  ',
          tag_filter: ' update ',
          thread_id: ' post-seed-2 ',
        },
        context
      );

      expect(fetchPostsSpy).toHaveBeenCalledWith('test-team', {
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
      expect(response.posts).toEqual([]);
      expect(response.error).toContain('agent_filter cannot be empty');
    });

    it('should reject empty tag_filter', async () => {
      const result = await readPostsToolHandler({ tag_filter: '   ' }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.posts).toEqual([]);
      expect(response.error).toContain('tag_filter cannot be empty');
    });

    it('should reject empty thread_id', async () => {
      const result = await readPostsToolHandler({ thread_id: '' }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.posts).toEqual([]);
      expect(response.error).toContain('thread_id cannot be empty');
    });

    it('should allow undefined filters', async () => {
      const result = await readPostsToolHandler(
        {
          agent_filter: undefined,
          tag_filter: undefined,
          thread_id: undefined,
        },
        context
      );

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      expect(response.posts).toBeDefined();
      expect(response.error).toBeUndefined();
    });
  });

  describe('Complex filtering scenarios', () => {
    it('should handle pagination with filters', async () => {
      // Get first page of alice's posts
      const page1 = await readPostsToolHandler(
        {
          agent_filter: 'agent-alice',
          limit: 1,
          offset: 0,
        },
        context
      );

      // Get second page
      const page2 = await readPostsToolHandler(
        {
          agent_filter: 'agent-alice',
          limit: 1,
          offset: 1,
        },
        context
      );

      const response1: ReadPostsToolResponse = JSON.parse(page1.content[0].text);
      const response2: ReadPostsToolResponse = JSON.parse(page2.content[0].text);

      // Should get different posts
      if (response1.posts!.length > 0 && response2.posts!.length > 0) {
        expect(response1.posts![0].id).not.toBe(response2.posts![0].id);
      }
    });

    it('should handle multiple tags correctly', async () => {
      // Add a post with multiple tags
      mockApiClient.addPost({
        id: 'multi-tag-post',
        team_name: 'test-team',
        author_name: 'agent-test',
        content: 'Post with multiple tags',
        tags: ['development', 'update', 'feature'],
        timestamp: new Date().toISOString(),
      });

      // Should find the post when filtering by any of its tags
      const result = await readPostsToolHandler({ tag_filter: 'feature' }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      const multiTagPost = response.posts!.find((p) => p.id === 'multi-tag-post');
      expect(multiTagPost).toBeDefined();
    });

    it('should handle thread filtering with nested replies', async () => {
      // Add nested thread structure
      const rootId = 'thread-root';
      const reply1Id = 'thread-reply-1';

      mockApiClient.addPost({
        id: rootId,
        team_name: 'test-team',
        author_name: 'agent-root',
        content: 'Root post',
        tags: ['discussion'],
        timestamp: new Date(Date.now() - 3000).toISOString(),
      });

      mockApiClient.addPost({
        id: reply1Id,
        team_name: 'test-team',
        author_name: 'agent-reply',
        content: 'Reply to root',
        tags: ['reply'],
        timestamp: new Date(Date.now() - 2000).toISOString(),
        parent_post_id: rootId,
      });

      mockApiClient.addPost({
        id: 'thread-reply-2',
        team_name: 'test-team',
        author_name: 'agent-nested',
        content: 'Reply to reply',
        tags: ['nested'],
        timestamp: new Date(Date.now() - 1000).toISOString(),
        parent_post_id: reply1Id,
      });

      // Filter by root thread ID should get root and direct replies
      const result = await readPostsToolHandler({ thread_id: rootId }, context);

      const response: ReadPostsToolResponse = JSON.parse(result.content[0].text);
      const threadPosts = response.posts!.filter(
        (p) => p.id === rootId || p.parent_post_id === rootId
      );
      expect(threadPosts.length).toBeGreaterThanOrEqual(2);
    });
  });
});
