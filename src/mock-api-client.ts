// ABOUTME: Mock implementation of ApiClient for testing purposes
// ABOUTME: Simulates API responses and various error conditions

import { IApiClient } from './api-client.js';
import {
  Post,
  PostData,
  PostResponse,
  PostsResponse,
  PostQueryOptions,
} from './types.js';

export class MockApiClient implements IApiClient {
  private posts: Map<string, Post> = new Map();
  private nextId = 1;
  private shouldFailAuth = false;
  private shouldFailNetwork = false;
  private shouldTimeout = false;
  private responseDelay = 0;

  constructor() {
    // Add some default posts
    this.seedPosts();
  }

  /**
   * Fetch posts with filtering support
   */
  async fetchPosts(teamName: string, options?: PostQueryOptions): Promise<PostsResponse> {
    await this.simulateDelay();
    this.checkErrors();

    let posts = Array.from(this.posts.values())
      .filter(post => post.team_name === teamName)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Newest first

    // Apply filters
    if (options?.agent_filter) {
      posts = posts.filter(post => post.author_name === options.agent_filter);
    }

    if (options?.tag_filter) {
      posts = posts.filter(post => post.tags.includes(options.tag_filter!));
    }

    if (options?.thread_id) {
      posts = posts.filter(post => 
        post.id === options.thread_id || post.parent_post_id === options.thread_id
      );
    }

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 10;
    const paginatedPosts = posts.slice(offset, offset + limit);

    return {
      posts: paginatedPosts,
      total: posts.length,
      has_more: offset + limit < posts.length,
    };
  }

  /**
   * Create a new post
   */
  async createPost(teamName: string, postData: PostData): Promise<PostResponse> {
    await this.simulateDelay();
    this.checkErrors();

    const post: Post = {
      id: `post-${this.nextId++}`,
      team_name: teamName,
      author_name: postData.author_name,
      content: postData.content,
      tags: postData.tags || [],
      timestamp: new Date().toISOString(),
      parent_post_id: postData.parent_post_id,
    };

    this.posts.set(post.id, post);

    return { post };
  }

  /**
   * Test helpers
   */
  setAuthFailure(shouldFail: boolean): void {
    this.shouldFailAuth = shouldFail;
  }

  setNetworkFailure(shouldFail: boolean): void {
    this.shouldFailNetwork = shouldFail;
  }

  setTimeout(shouldTimeout: boolean): void {
    this.shouldTimeout = shouldTimeout;
  }

  setResponseDelay(delayMs: number): void {
    this.responseDelay = delayMs;
  }

  clearPosts(): void {
    this.posts.clear();
    this.nextId = 1;
  }

  addPost(post: Post): void {
    this.posts.set(post.id, post);
  }

  getPostCount(): number {
    return this.posts.size;
  }

  /**
   * Private helpers
   */
  private async simulateDelay(): Promise<void> {
    if (this.responseDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.responseDelay));
    }
  }

  private checkErrors(): void {
    if (this.shouldTimeout) {
      throw new Error('Request timeout after 30000ms');
    }

    if (this.shouldFailAuth) {
      throw new Error('Authentication failed: Invalid API key');
    }

    if (this.shouldFailNetwork) {
      throw new Error('Network error: Failed to fetch');
    }
  }

  private seedPosts(): void {
    const now = new Date();
    
    // Add some sample posts
    const samplePosts: Post[] = [
      {
        id: 'post-seed-1',
        team_name: 'test-team',
        author_name: 'agent-alice',
        content: 'Hello, this is my first post!',
        tags: ['introduction', 'hello'],
        timestamp: new Date(now.getTime() - 3600000).toISOString(), // 1 hour ago
      },
      {
        id: 'post-seed-2',
        team_name: 'test-team',
        author_name: 'agent-bob',
        content: 'Working on some interesting features today.',
        tags: ['development', 'update'],
        timestamp: new Date(now.getTime() - 1800000).toISOString(), // 30 min ago
      },
      {
        id: 'post-seed-3',
        team_name: 'test-team',
        author_name: 'agent-alice',
        content: 'Great progress on the project!',
        tags: ['update'],
        timestamp: new Date(now.getTime() - 900000).toISOString(), // 15 min ago
        parent_post_id: 'post-seed-2',
      },
      {
        id: 'post-seed-4',
        team_name: 'other-team',
        author_name: 'agent-charlie',
        content: 'Different team post',
        tags: ['other'],
        timestamp: now.toISOString(),
      },
    ];

    samplePosts.forEach(post => this.posts.set(post.id, post));
  }
}