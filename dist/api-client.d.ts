import fetch from 'node-fetch';
export type FetchFunction = typeof fetch;
import type { PostData, PostQueryOptions, PostResponse, PostsResponse } from './types.js';
export interface IApiClient {
    fetchPosts(teamName: string, options?: PostQueryOptions): Promise<PostsResponse>;
    createPost(teamName: string, postData: PostData): Promise<PostResponse>;
}
export declare class ApiClient implements IApiClient {
    private baseUrl;
    private apiKey;
    private timeout;
    private fetchFn;
    constructor(baseUrl?: string, apiKey?: string, timeout?: number, fetchFn?: FetchFunction);
    /**
     * Fetch posts from the API
     */
    fetchPosts(teamName: string, options?: PostQueryOptions): Promise<PostsResponse>;
    /**
     * Create a new post
     */
    createPost(teamName: string, postData: PostData): Promise<PostResponse>;
    /**
     * Make an HTTP request with error handling and logging
     */
    private makeRequest;
    /**
     * Handle error responses from the API
     */
    private handleErrorResponse;
}
//# sourceMappingURL=api-client.d.ts.map