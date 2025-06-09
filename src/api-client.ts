// ABOUTME: HTTP client for communicating with the external social media API
// ABOUTME: Handles authentication, error handling, and typed responses

import fetch, { type RequestInit, type Response } from 'node-fetch';

// Type for the fetch function to enable mocking in tests
export type FetchFunction = typeof fetch;
import { config } from './config.js';
import { logger } from './logger.js';
import type { PostData, PostQueryOptions, PostResponse, PostsResponse } from './types.js';

// Remote API response types
interface RemotePost {
  postId: string;
  author: string;
  content: string;
  tags?: string[];
  createdAt?: {
    _seconds: number;
  };
  parentPostId?: string;
}

interface RemotePostsResponse {
  posts: RemotePost[];
  totalCount: number;
  nextOffset?: string;
}

interface RemotePostResponse {
  postId: string;
  author: string;
  content: string;
  tags?: string[];
  createdAt?: {
    _seconds: number;
  };
  parentPostId?: string;
}

export interface IApiClient {
  fetchPosts(teamName: string, options?: PostQueryOptions): Promise<PostsResponse>;
  createPost(teamName: string, postData: PostData): Promise<PostResponse>;
}

export class ApiClient implements IApiClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;
  private fetchFn: FetchFunction;

  constructor(
    baseUrl: string = config.socialApiBaseUrl,
    apiKey: string = config.socialApiKey,
    timeout: number = config.apiTimeout,
    fetchFn: FetchFunction = fetch,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
    this.timeout = timeout;
    this.fetchFn = fetchFn;

    logger.debug('ApiClient initialized', {
      baseUrl: this.baseUrl,
      timeout: this.timeout,
      hasApiKey: !!this.apiKey,
    });
  }

  /**
   * Fetch posts from the API
   */
  async fetchPosts(teamName: string, options?: PostQueryOptions): Promise<PostsResponse> {
    const params = new URLSearchParams();

    if (options?.limit !== undefined) {
      params.append('limit', options.limit.toString());
    }
    // Remote API uses cursor-based pagination, not numeric offset
    // For now, we'll ignore the offset parameter since the remote API doesn't support it
    // TODO: Implement proper cursor-based pagination mapping
    // Note: remote API may not support agent/tag filters - these params might be ignored
    if (options?.agent_filter) {
      params.append('agent', options.agent_filter);
    }
    if (options?.tag_filter) {
      params.append('tag', options.tag_filter);
    }
    if (options?.thread_id) {
      params.append('thread_id', options.thread_id);
    }

    const queryString = params.toString();
    const url = `${this.baseUrl}/teams/${encodeURIComponent(teamName)}/posts${
      queryString ? `?${queryString}` : ''
    }`;

    logger.debug('Fetching posts', {
      teamName,
      queryParams: Object.fromEntries(params),
      url,
    });

    const response = await this.makeRequest('GET', url);
    const remoteResponse = response as RemotePostsResponse;

    // Validate remote response
    if (!remoteResponse.posts || !Array.isArray(remoteResponse.posts)) {
      throw new Error('Invalid API response: posts array missing or malformed');
    }

    // Adapt remote response to our schema
    const adaptedPosts = remoteResponse.posts
      .filter((post: RemotePost) => {
        if (!post.postId || !post.author || !post.content) {
          logger.warn('Skipping malformed post', { post });
          return false;
        }
        return true;
      })
      .map((post: RemotePost) => ({
        id: post.postId,
        author_name: post.author,
        content: post.content,
        tags: post.tags || [],
        timestamp: post.createdAt?._seconds
          ? new Date(post.createdAt._seconds * 1000).toISOString()
          : new Date().toISOString(),
        parent_post_id: post.parentPostId || undefined,
        team_name: teamName,
      }));

    const adaptedResponse: PostsResponse = {
      posts: adaptedPosts,
      total: adaptedPosts.length, // Remote API doesn't provide total, estimate from current page
      has_more: Boolean(remoteResponse.nextOffset),
    };

    return adaptedResponse;
  }

  /**
   * Create a new post
   */
  async createPost(teamName: string, postData: PostData): Promise<PostResponse> {
    const url = `${this.baseUrl}/teams/${encodeURIComponent(teamName)}/posts`;

    logger.debug('Creating post', {
      teamName,
      url,
      hasContent: !!postData.content,
      tagsCount: postData.tags?.length || 0,
    });

    // Adapt to remote API schema - use 'author' instead of 'author_name'
    const remotePostData = {
      author: postData.author_name,
      content: postData.content,
      tags: postData.tags,
      parentPostId: postData.parent_post_id,
    };

    const response = await this.makeRequest('POST', url, remotePostData);
    const remoteResponse = response as RemotePostResponse;

    // Adapt remote response back to our schema
    const adaptedResponse: PostResponse = {
      post: {
        id: remoteResponse.postId,
        author_name: remoteResponse.author,
        content: remoteResponse.content,
        tags: remoteResponse.tags || [],
        timestamp: remoteResponse.createdAt?._seconds
          ? new Date(remoteResponse.createdAt._seconds * 1000).toISOString()
          : new Date().toISOString(),
        parent_post_id: remoteResponse.parentPostId || undefined,
        team_name: teamName,
      },
    };

    return adaptedResponse;
  }

  /**
   * Make an HTTP request with error handling and logging
   */
  private async makeRequest(method: string, url: string, body?: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    const startTime = Date.now();

    try {
      const options: RequestInit = {
        method,
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        signal: controller.signal,
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      logger.apiRequest(method, url, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          hasApiKey: !!this.apiKey,
        },
        hasBody: !!body,
        timeout: this.timeout,
      });

      const response = await this.fetchFn(url, options);
      const duration = Date.now() - startTime;

      if (!response.ok) {
        logger.apiResponse(method, url, response.status, duration, {
          statusText: response.statusText,
          failed: true,
        });
        throw await this.handleErrorResponse(response);
      }

      logger.apiResponse(method, url, response.status, duration);
      const data = await response.json();
      return data;
    } catch (error) {
      const duration = Date.now() - startTime;
      if (error instanceof Error && error.name === 'AbortError') {
        logger.apiError(method, url, new Error(`Request timeout after ${this.timeout}ms`), {
          duration,
          timeout: true,
        });
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      logger.apiError(method, url, error instanceof Error ? error : new Error(String(error)), {
        duration,
        errorType: error instanceof Error ? error.name : 'unknown',
      });
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Handle error responses from the API
   */
  private async handleErrorResponse(response: Response): Promise<Error> {
    let errorMessage = `API request failed: ${response.status} ${response.statusText}`;

    try {
      const errorData = (await response.json()) as {
        error?: string;
        message?: string;
        code?: string;
      };
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // Ignore JSON parse errors
    }

    // Error handled, no logging needed for production

    switch (response.status) {
      case 401:
        throw new Error(`Authentication failed: ${errorMessage}`);
      case 403:
        throw new Error(`Access forbidden: ${errorMessage}`);
      case 404:
        throw new Error(`Resource not found: ${errorMessage}`);
      case 429:
        throw new Error(`Rate limit exceeded: ${errorMessage}`);
      case 500:
      case 502:
      case 503:
      case 504:
        throw new Error(`Server error: ${errorMessage}`);
      default:
        throw new Error(errorMessage);
    }
  }
}
