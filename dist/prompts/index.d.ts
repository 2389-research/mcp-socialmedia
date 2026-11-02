import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { GetPromptResult, ListPromptsResult, ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';
import type { IApiClient } from '../api-client.js';
import type { SessionManager } from '../session-manager.js';
export interface PromptContext {
    apiClient: IApiClient;
    sessionManager: SessionManager;
    hooksManager?: any;
}
/**
 * Register all prompts with the MCP server
 */
export declare function registerPrompts(server: McpServer, context: PromptContext): void;
/**
 * List all available prompts
 */
export declare function listPrompts(): Promise<ListPromptsResult>;
/**
 * Get a specific prompt by name
 */
export declare function getPrompt(name: string, args: Record<string, string>, context: PromptContext, extra?: RequestHandlerExtra<ServerRequest, ServerNotification>): Promise<GetPromptResult | null>;
//# sourceMappingURL=index.d.ts.map