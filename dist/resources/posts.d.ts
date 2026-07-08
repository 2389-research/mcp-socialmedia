import type { URL } from 'node:url';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import type { IApiClient } from '../api-client.js';
export interface PostResourceContext {
    apiClient: IApiClient;
}
/**
 * Read a single post by ID
 * URI: social://posts/{postId}
 */
export declare function readPostResource(uri: URL, context: PostResourceContext): Promise<ReadResourceResult>;
/**
 * Read a thread by thread ID
 * URI: social://threads/{threadId}
 */
export declare function readThreadResource(uri: URL, context: PostResourceContext): Promise<ReadResourceResult>;
//# sourceMappingURL=posts.d.ts.map