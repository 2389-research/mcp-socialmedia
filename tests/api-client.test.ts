// ABOUTME: Tests for ApiClient functionality with mocked fetch
// ABOUTME: Uses dependency injection to mock HTTP requests in tests only

import { jest } from '@jest/globals';
import { ApiClient, FetchFunction } from '../src/api-client';
import { PostData, PostQueryOptions } from '../src/types';

describe('ApiClient', () => {
  let apiClient: ApiClient;
  let mockFetch: jest.MockedFunction<FetchFunction>;
  const baseUrl = 'https://api.test.com';
  const apiKey = 'test-api-key';

  beforeEach(() => {
    // Create a mocked fetch function
    mockFetch = jest.fn() as jest.MockedFunction<FetchFunction>;

    // Create API client with mocked fetch
    apiClient = new ApiClient(baseUrl, apiKey, 30000, mockFetch);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchPosts', () => {
    it('should fetch posts successfully', async () => {
      // Mock response in remote API format
      const mockRemoteResponse = {
        posts: [
          {
            postId: 'post-1',
            teamId: 'test-team',
            author: 'test-user',
            content: 'Test content',
            tags: ['test'],
            createdAt: { _seconds: 1672531200, _nanoseconds: 0 }, // 2023-01-01T00:00:00Z
            parentPostId: null,
          },
        ],
        nextOffset: null,
      };

      // Expected result after schema adaptation
      const expectedResult = {
        posts: [
          {
            id: 'post-1',
            team_name: 'test-team',
            author_name: 'test-user',
            content: 'Test content',
            tags: ['test'],
            timestamp: '2023-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        has_more: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue(mockRemoteResponse),
      } as any);

      const result = await apiClient.fetchPosts('test-team');

      expect(result).toEqual(expectedResult);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/teams/test-team/posts`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'x-api-key': apiKey,
          }),
        })
      );
    });

    it('should include query parameters when provided', async () => {
      const options: PostQueryOptions = {
        limit: 5,
        agent_filter: 'test-agent',
        tag_filter: 'test-tag',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({ posts: [], total: 0, has_more: false }),
      } as any);

      await apiClient.fetchPosts('test-team', options);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=5&agent=test-agent&tag=test-tag'),
        expect.any(Object)
      );
    });

    it('should handle authentication errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: jest.fn().mockResolvedValue({ error: 'Invalid API key' }),
      } as any);

      await expect(apiClient.fetchPosts('test-team')).rejects.toThrow(
        'Authentication failed: Invalid API key'
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(apiClient.fetchPosts('test-team')).rejects.toThrow('Network error');
    });
  });

  describe('createPost', () => {
    it('should create post successfully', async () => {
      const postData: PostData = {
        author_name: 'test-user',
        content: 'Test post content',
        tags: ['test'],
      };

      // Mock response in remote API format
      const mockRemoteResponse = {
        postId: 'new-post-1',
        teamId: 'test-team',
        author: postData.author_name,
        content: postData.content,
        tags: postData.tags,
        createdAt: { _seconds: 1672531200, _nanoseconds: 0 }, // 2023-01-01T00:00:00Z
        parentPostId: null,
      };

      // Expected result after schema adaptation
      const expectedResult = {
        post: {
          id: 'new-post-1',
          team_name: 'test-team',
          author_name: 'test-user',
          content: 'Test post content',
          tags: ['test'],
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        json: jest.fn().mockResolvedValue(mockRemoteResponse),
      } as any);

      const result = await apiClient.createPost('test-team', postData);

      expect(result).toEqual(expectedResult);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/teams/test-team/posts`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            author: postData.author_name,
            content: postData.content,
            tags: postData.tags,
            parentPostId: postData.parent_post_id,
          }),
        })
      );
    });

    it('should handle validation errors', async () => {
      const postData: PostData = {
        author_name: '',
        content: '',
        tags: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        json: jest.fn().mockResolvedValue({ error: 'Validation failed' }),
      } as any);

      await expect(apiClient.createPost('test-team', postData)).rejects.toThrow(
        'Validation failed'
      );
    });

    it('should handle rate limiting', async () => {
      const postData: PostData = {
        author_name: 'test-user',
        content: 'Test content',
        tags: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: jest.fn().mockResolvedValue({ error: 'Rate limit exceeded' }),
      } as any);

      await expect(apiClient.createPost('test-team', postData)).rejects.toThrow(
        'Rate limit exceeded: Rate limit exceeded'
      );
    });
  });

  describe('error handling', () => {
    it('should handle server errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: jest.fn().mockResolvedValue({ error: 'Server error' }),
      } as any);

      await expect(apiClient.fetchPosts('test-team')).rejects.toThrow('Server error: Server error');
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as any);

      await expect(apiClient.fetchPosts('test-team')).rejects.toThrow(
        'API request failed: 400 Bad Request'
      );
    });
  });

  describe('constructor', () => {
    it('should create an ApiClient with default fetch', () => {
      // Test that we can create without providing fetch (uses real fetch in production)
      const defaultClient = new ApiClient(baseUrl, apiKey, 30000);
      expect(defaultClient).toBeInstanceOf(ApiClient);
    });

    it('should create an ApiClient with custom fetch for testing', () => {
      expect(apiClient).toBeInstanceOf(ApiClient);
    });
  });
});
