// ABOUTME: HTTP client for communicating with the external social media API
// ABOUTME: Handles authentication, error handling, and typed responses

import fetch, { RequestInit, Response } from 'node-fetch';
import { PostData, PostResponse, PostsResponse, PostQueryOptions } from './types.js';
import { config } from './config.js';

export interface IApiClient {
  fetchPosts(teamName: string, options?: PostQueryOptions): Promise<PostsResponse>;
  createPost(teamName: string, postData: PostData): Promise<PostResponse>;
}

export class ApiClient implements IApiClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(
    baseUrl: string = config.socialApiBaseUrl,
    apiKey: string = config.socialApiKey,
    timeout: number = config.apiTimeout
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
    this.timeout = timeout;
  }

  /**
   * Fetch posts from the API
   */
  async fetchPosts(teamName: string, options?: PostQueryOptions): Promise<PostsResponse> {
    const params = new URLSearchParams();

    if (options?.limit !== undefined) {
      params.append('limit', options.limit.toString());
    }
    if (options?.offset !== undefined) {
      params.append('offset', options.offset.toString());
    }
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

    const response = await this.makeRequest('GET', url);
    return response as PostsResponse;
  }

  /**
   * Create a new post
   */
  async createPost(teamName: string, postData: PostData): Promise<PostResponse> {
    const url = `${this.baseUrl}/teams/${encodeURIComponent(teamName)}/posts`;

    const response = await this.makeRequest('POST', url, postData);
    return response as PostResponse;
  }

  /**
   * Make an HTTP request with error handling and logging
   */
  private async makeRequest(method: string, url: string, body?: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const options: RequestInit = {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        signal: controller.signal,
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      // Log request
      console.error(`[API] ${method} ${url}`);
      if (body) {
        console.error('[API] Request body:', JSON.stringify(body, null, 2));
      }

      const response = await fetch(url, options);

      // Log response
      console.error(`[API] Response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const data = await response.json();
      console.error('[API] Response body:', JSON.stringify(data, null, 2));

      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
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

    // Log the error for debugging
    console.error(`[API] Error ${response.status}:`, errorMessage);

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
