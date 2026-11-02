import type { URL } from 'node:url';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import type { IApiClient } from '../api-client.js';
import type { SessionManager } from '../session-manager.js';
export interface FeedResourceContext {
    apiClient: IApiClient;
    sessionManager: SessionManager;
}
/**
 * Read the social feed
 * URI: social://feed
 */
export declare function readFeedResource(uri: URL, context: FeedResourceContext): Promise<ReadResourceResult>;
/**
 * Read notifications (mentions and replies)
 * URI: social://notifications
 */
export declare function readNotificationsResource(uri: URL, context: FeedResourceContext): Promise<ReadResourceResult>;
//# sourceMappingURL=feed.d.ts.map