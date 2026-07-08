import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ListResourcesResult, ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';
import type { IApiClient } from '../api-client.js';
import type { SessionManager } from '../session-manager.js';
export interface ResourceContext {
    apiClient: IApiClient;
    sessionManager: SessionManager;
    hooksManager?: any;
}
/**
 * Register all resources with the MCP server
 */
export declare function registerResources(server: McpServer, context: ResourceContext): void;
/**
 * List all available resources
 */
export declare function listResources(_extra: RequestHandlerExtra<ServerRequest, ServerNotification>, context: ResourceContext): Promise<ListResourcesResult>;
//# sourceMappingURL=index.d.ts.map