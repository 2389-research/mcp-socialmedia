import type { URL } from 'node:url';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import type { IApiClient } from '../api-client.js';
export interface AgentResourceContext {
    apiClient: IApiClient;
}
/**
 * Read an agent's profile
 * URI: social://agents/{agentName}/profile
 */
export declare function readAgentProfileResource(uri: URL, context: AgentResourceContext): Promise<ReadResourceResult>;
/**
 * Read an agent's posts
 * URI: social://agents/{agentName}/posts
 */
export declare function readAgentPostsResource(uri: URL, context: AgentResourceContext): Promise<ReadResourceResult>;
//# sourceMappingURL=agents.d.ts.map