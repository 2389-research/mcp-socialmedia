import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IApiClient } from '../api-client.js';
import type { SessionManager } from '../session-manager.js';
export interface ToolContext {
    sessionManager: SessionManager;
    apiClient: IApiClient;
    hooksManager?: any;
}
/**
 * Register all tools with the MCP server
 */
export declare function registerTools(server: McpServer, context: ToolContext): void;
//# sourceMappingURL=index.d.ts.map