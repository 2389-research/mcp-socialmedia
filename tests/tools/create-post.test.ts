// ABOUTME: Tests for the create post tool functionality
// ABOUTME: Validates session requirements, input validation, and post creation

import { jest } from '@jest/globals';
import { createPostToolHandler, CreatePostToolContext } from '../../src/tools/create-post';
import { SessionManager } from '../../src/session-manager';
import { ApiClient } from '../../src/api-client';
import { CreatePostToolResponse, Post } from '../../src/types';
import { config } from '../../src/config';

describe('Create Post Tool', () => {
  let sessionManager: SessionManager;
  let mockApiClient: jest.Mocked<ApiClient>;
  let context: CreatePostToolContext;
  let mockGetSessionId: jest.Mock<() => string>;
  let postIdCounter = 0;

  beforeEach(() => {
    // Reset counter for unique IDs
    postIdCounter = 0;

    // Set up environment
    process.env.TEAM_NAME = 'test-team';

    sessionManager = new SessionManager();
    mockApiClient = {
      fetchPosts: jest.fn(),
      createPost: jest.fn(),
    } as jest.Mocked<ApiClient>;
    mockGetSessionId = jest.fn(() => 'test-session-123');

    context = {
      sessionManager,
      apiClient: mockApiClient,
      getSessionId: mockGetSessionId,
    };

    // Set up default mock responses
    mockApiClient.createPost.mockImplementation(async (teamName, postData) => ({
      post: {
        id: `post-${Date.now()}-${++postIdCounter}`,
        team_name: teamName,
        author_name: postData.author_name,
        content: postData.content,
        tags: postData.tags || [],
        timestamp: new Date().toISOString(),
        parent_post_id: postData.parent_post_id,
      },
    }));

    mockApiClient.fetchPosts.mockResolvedValue({
      posts: [],
      total: 0,
      has_more: false,
    });
  });

  describe('Successful post creation', () => {
    beforeEach(async () => {
      // Create a logged-in session
      await sessionManager.createSession('test-session-123', 'test-agent');
    });

    it('should create a post with content only', async () => {
      const content = 'This is my test post';
      const result = await createPostToolHandler({ content }, context);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.post).toBeDefined();
      expect(response.post!.content).toBe(content);
      expect(response.post!.author_name).toBe('test-agent');
      expect(response.post!.team_name).toBe(config.teamName);
      expect(response.post!.id).toBeDefined();
      expect(response.post!.timestamp).toBeDefined();
      expect(response.error).toBeUndefined();
    });

    it('should create a post with content and tags', async () => {
      const content = 'Post with tags';
      const tags = ['announcement', 'update'];

      const result = await createPostToolHandler({ content, tags }, context);

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.post!.content).toBe(content);
      expect(response.post!.tags).toEqual(tags);
    });

    it('should trim content and tags', async () => {
      const result = await createPostToolHandler(
        {
          content: '  Trimmed content  ',
          tags: [' tag1 ', '  tag2  '],
        },
        context
      );

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.post!.content).toBe('Trimmed content');
      expect(response.post!.tags).toEqual(['tag1', 'tag2']);
    });

    it('should filter out empty tags after trimming', async () => {
      const result = await createPostToolHandler(
        {
          content: 'Post with filtered tags',
          tags: ['valid', '  ', '', 'another'],
        },
        context
      );

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.post!.tags).toEqual(['valid', 'another']);
    });

    it('should generate unique post IDs', async () => {
      const result1 = await createPostToolHandler({ content: 'First post' }, context);
      const result2 = await createPostToolHandler({ content: 'Second post' }, context);

      const response1: CreatePostToolResponse = JSON.parse(result1.content[0].text);
      const response2: CreatePostToolResponse = JSON.parse(result2.content[0].text);

      expect(response1.post!.id).not.toBe(response2.post!.id);
    });

    it('should call the API client to create posts', async () => {
      await createPostToolHandler({ content: 'New post' }, context);

      expect(mockApiClient.createPost).toHaveBeenCalledWith(config.teamName, {
        author_name: 'test-agent',
        content: 'New post',
        tags: undefined,
        parent_post_id: undefined,
      });
    });
  });

  describe('Session validation', () => {
    it('should reject post creation when not logged in', async () => {
      // No session created
      const result = await createPostToolHandler({ content: 'Test post' }, context);

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Authentication required');
      expect(response.details).toContain('must be logged in');
      expect(response.post).toBeUndefined();
    });

    it('should use agent name from session', async () => {
      await sessionManager.createSession('test-session-123', 'specific-agent');

      const result = await createPostToolHandler({ content: 'Agent post' }, context);

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.post!.author_name).toBe('specific-agent');
    });

    it('should use the correct session ID', async () => {
      const customSessionId = 'custom-session-456';
      mockGetSessionId.mockReturnValue(customSessionId);

      // Create session with custom ID
      await sessionManager.createSession(customSessionId, 'custom-agent');

      const result = await createPostToolHandler({ content: 'Custom session post' }, context);

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.post!.author_name).toBe('custom-agent');
      expect(mockGetSessionId).toHaveBeenCalled();
    });
  });

  describe('Input validation', () => {
    beforeEach(async () => {
      // Create a logged-in session for validation tests
      await sessionManager.createSession('test-session-123', 'test-agent');
    });

    it('should reject empty content', async () => {
      const result = await createPostToolHandler({ content: '' }, context);

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid input');
      expect(response.details).toContain('Content must not be empty');
    });

    it('should reject whitespace-only content', async () => {
      const result = await createPostToolHandler({ content: '   ' }, context);

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid input');
      expect(response.details).toContain('Content must not be empty');
    });

    it('should reject null content', async () => {
      const result = await createPostToolHandler({ content: null as any }, context);

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid input');
    });

    it('should reject undefined content', async () => {
      const result = await createPostToolHandler({ content: undefined as any }, context);

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid input');
    });

    it('should filter out empty tags in array', async () => {
      const result = await createPostToolHandler(
        {
          content: 'Valid content',
          tags: ['valid', '', 'another'],
        },
        context
      );

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.post!.tags).toEqual(['valid', 'another']);
    });

    it('should accept empty tags array', async () => {
      const result = await createPostToolHandler(
        {
          content: 'Post with empty tags array',
          tags: [],
        },
        context
      );

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.post!.tags).toEqual([]);
    });

    it('should accept undefined tags', async () => {
      const result = await createPostToolHandler(
        {
          content: 'Post without tags',
          tags: undefined,
        },
        context
      );

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      // tags might be undefined or empty array depending on API
    });
  });

  describe('API integration', () => {
    beforeEach(async () => {
      await sessionManager.createSession('test-session-123', 'test-agent');
    });

    it('should pass correct data to API client', async () => {
      const createPostSpy = jest.spyOn(mockApiClient, 'createPost');

      await createPostToolHandler(
        {
          content: 'API test post',
          tags: ['test', 'api'],
        },
        context
      );

      expect(createPostSpy).toHaveBeenCalledWith(config.teamName, {
        author_name: 'test-agent',
        content: 'API test post',
        tags: ['test', 'api'],
      });
    });

    it('should use team name from configuration', async () => {
      const createPostSpy = jest.spyOn(mockApiClient, 'createPost');

      await createPostToolHandler({ content: 'Team test' }, context);

      expect(createPostSpy).toHaveBeenCalledWith(config.teamName, expect.any(Object));
    });
  });

  describe('Error handling', () => {
    beforeEach(async () => {
      await sessionManager.createSession('test-session-123', 'test-agent');
    });

    it('should handle API authentication failure', async () => {
      mockApiClient.createPost.mockRejectedValueOnce(
        new Error('Authentication failed: Invalid API key')
      );

      const result = await createPostToolHandler({ content: 'Auth fail test' }, context);

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Failed to create post');
      expect(response.details).toContain('Authentication failed');
    });

    it('should handle network errors', async () => {
      mockApiClient.createPost.mockRejectedValueOnce(new Error('Network error: Failed to fetch'));

      const result = await createPostToolHandler({ content: 'Network fail test' }, context);

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Failed to create post');
      expect(response.details).toContain('Network error');
    });

    it('should handle API timeout', async () => {
      mockApiClient.createPost.mockRejectedValueOnce(new Error('Request timeout after 30000ms'));

      const result = await createPostToolHandler({ content: 'Timeout test' }, context);

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Failed to create post');
      expect(response.details).toContain('Request timeout');
    });

    it('should handle unexpected errors', async () => {
      mockApiClient.createPost.mockRejectedValueOnce(new Error('Unexpected error'));

      const result = await createPostToolHandler({ content: 'Error test' }, context);

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Failed to create post');
      expect(response.details).toBe('Unexpected error');
    });
  });

  describe('Response format', () => {
    beforeEach(async () => {
      await sessionManager.createSession('test-session-123', 'test-agent');
    });

    it('should always return MCP-compliant response structure', async () => {
      const result = await createPostToolHandler({ content: 'Format test' }, context);

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
      expect(typeof result.content[0].text).toBe('string');

      // Verify JSON is valid
      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });

    it('should include all fields in successful response', async () => {
      const result = await createPostToolHandler(
        {
          content: 'Complete response test',
          tags: ['complete'],
        },
        context
      );

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('post');
      expect(response.post).toHaveProperty('id');
      expect(response.post).toHaveProperty('team_name');
      expect(response.post).toHaveProperty('author_name');
      expect(response.post).toHaveProperty('content');
      expect(response.post).toHaveProperty('tags');
      expect(response.post).toHaveProperty('timestamp');
      expect(response).not.toHaveProperty('error');
      expect(response).not.toHaveProperty('details');
    });

    it('should include error fields in failure response', async () => {
      // No session
      await sessionManager.deleteSession('test-session-123');

      const result = await createPostToolHandler({ content: 'Fail test' }, context);

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response).toHaveProperty('success', false);
      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('details');
      expect(response).not.toHaveProperty('post');
    });
  });

  describe('Special content handling', () => {
    beforeEach(async () => {
      await sessionManager.createSession('test-session-123', 'test-agent');
    });

    it('should handle very long content', async () => {
      const longContent = 'A'.repeat(1000);

      const result = await createPostToolHandler({ content: longContent }, context);

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.post!.content).toBe(longContent);
    });

    it('should handle special characters in content', async () => {
      const specialContent = 'Post with "quotes", \'apostrophes\', and \nnewlines\t\ttabs';

      const result = await createPostToolHandler({ content: specialContent }, context);

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.post!.content).toBe(specialContent);
    });

    it('should handle unicode in content and tags', async () => {
      const unicodeContent = 'Hello 世界 🌍 مرحبا';
      const unicodeTags = ['emoji-🎯', '中文', 'العربية'];

      const result = await createPostToolHandler(
        {
          content: unicodeContent,
          tags: unicodeTags,
        },
        context
      );

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.post!.content).toBe(unicodeContent);
      expect(response.post!.tags).toEqual(unicodeTags);
    });
  });

  describe('Reply functionality', () => {
    beforeEach(async () => {
      // Create a logged-in session
      await sessionManager.createSession('test-session-123', 'test-agent');

      // Mock fetchPosts to return a parent post
      mockApiClient.fetchPosts.mockResolvedValue({
        posts: [
          {
            id: 'parent-post-1',
            team_name: config.teamName,
            author_name: 'test-author',
            content: 'This is a parent post',
            tags: ['discussion'],
            timestamp: new Date().toISOString(),
          },
        ],
        total: 1,
        has_more: false,
      });
    });

    it('should create a reply to an existing post', async () => {
      const result = await createPostToolHandler(
        {
          content: 'This is a reply',
          parent_post_id: 'parent-post-1',
        },
        context
      );

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.post).toBeDefined();
      expect(response.post!.content).toBe('This is a reply');
      expect(response.post!.parent_post_id).toBe('parent-post-1');
    });

    it('should create a reply with tags', async () => {
      const result = await createPostToolHandler(
        {
          content: 'Reply with tags',
          tags: ['response', 'feedback'],
          parent_post_id: 'parent-post-1',
        },
        context
      );

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.post!.tags).toEqual(['response', 'feedback']);
      expect(response.post!.parent_post_id).toBe('parent-post-1');
    });

    it('should allow reply to any parent post ID (validation removed for performance)', async () => {
      const result = await createPostToolHandler(
        {
          content: 'Reply to ghost',
          parent_post_id: 'non-existent-post',
        },
        context
      );

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.post).toBeDefined();
      expect(response.post!.parent_post_id).toBe('non-existent-post');
    });

    it('should allow nested replies (reply to a reply)', async () => {
      // First create a reply
      const firstReply = await createPostToolHandler(
        {
          content: 'First level reply',
          parent_post_id: 'parent-post-1',
        },
        context
      );

      const firstResponse: CreatePostToolResponse = JSON.parse(firstReply.content[0].text);
      expect(firstResponse.success).toBe(true);
      const firstReplyId = firstResponse.post!.id;

      // Update mock to include the new reply for nested reply test
      mockApiClient.fetchPosts.mockResolvedValue({
        posts: [
          {
            id: 'parent-post-1',
            team_name: config.teamName,
            author_name: 'test-author',
            content: 'This is a parent post',
            tags: ['discussion'],
            timestamp: new Date().toISOString(),
            deleted: false,
          },
          firstResponse.post!,
        ],
        total: 2,
        has_more: false,
      });

      // Create a reply to the reply
      const nestedReply = await createPostToolHandler(
        {
          content: 'Nested reply',
          parent_post_id: firstReplyId,
        },
        context
      );

      const nestedResponse: CreatePostToolResponse = JSON.parse(nestedReply.content[0].text);
      expect(nestedResponse.success).toBe(true);
      expect(nestedResponse.post!.parent_post_id).toBe(firstReplyId);
    });

    it('should require login for creating replies', async () => {
      // Delete the session
      await sessionManager.deleteSession('test-session-123');

      const result = await createPostToolHandler(
        {
          content: 'Unauthorized reply',
          parent_post_id: 'parent-post-1',
        },
        context
      );

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Authentication required');
    });

    it('should handle parent post validation errors gracefully', async () => {
      // Since parent post validation is removed for performance,
      // the handler should succeed even if fetchPosts would fail
      // The API server will handle invalid parent_post_id gracefully
      mockApiClient.fetchPosts.mockRejectedValueOnce(new Error('Network error during validation'));

      const result = await createPostToolHandler(
        {
          content: 'Reply with network error',
          parent_post_id: 'parent-post-1',
        },
        context
      );

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      // Should succeed because parent validation is skipped
      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.post).toBeDefined();
        expect(response.post.parent_post_id).toBe('parent-post-1');
      }
    });

    it('should maintain all post properties when creating a reply', async () => {
      const content = 'Full featured reply';
      const tags = ['important', 'urgent'];

      const result = await createPostToolHandler(
        {
          content,
          tags,
          parent_post_id: 'parent-post-1',
        },
        context
      );

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);

      const post = response.post!;
      expect(post.content).toBe(content);
      expect(post.tags).toEqual(tags);
      expect(post.parent_post_id).toBe('parent-post-1');
      expect(post.author_name).toBe('test-agent');
      expect(post.team_name).toBe(config.teamName);
      expect(post.id).toBeDefined();
      expect(post.timestamp).toBeDefined();
    });

    it('should create regular posts when parent_post_id is not provided', async () => {
      const result = await createPostToolHandler(
        {
          content: 'Regular post, not a reply',
          tags: ['regular'],
        },
        context
      );

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.post!.parent_post_id).toBeUndefined();
    });

    it('should allow empty parent_post_id (validation removed)', async () => {
      const result = await createPostToolHandler(
        {
          content: 'Reply with empty parent',
          parent_post_id: '',
        },
        context
      );

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.post).toBeDefined();
    });

    it('should allow replies to any post ID (validation removed)', async () => {
      // Parent validation removed, so cross-team replies are allowed
      const result = await createPostToolHandler(
        {
          content: 'Cross-team reply attempt',
          parent_post_id: 'other-team-post',
        },
        context
      );

      const response: CreatePostToolResponse = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.post).toBeDefined();
      expect(response.post!.parent_post_id).toBe('other-team-post');
    });
  });
});
