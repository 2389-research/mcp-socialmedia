// ABOUTME: Main tool registration for MCP tools
// ABOUTME: Consolidates tool registration logic for reuse across transports
import { logger } from '../logger.js';
import { createPostToolHandler, createPostToolSchema, } from './create-post.js';
import { loginToolHandler, loginToolSchema } from './login.js';
import { readPostsToolHandler, readPostsToolSchema, } from './read-posts.js';
/**
 * Register all tools with the MCP server
 */
export function registerTools(server, context) {
    logger.info('Registering MCP tools');
    // Register the login tool
    server.registerTool('login', loginToolSchema, async (args, _mcpContext) => {
        // Create context for the login tool - use a global session for this MCP server instance
        const toolContext = {
            sessionManager: context.sessionManager,
            getSessionId: () => 'global-session',
        };
        return loginToolHandler(args, toolContext);
    });
    // Register the read_posts tool
    server.registerTool('read_posts', readPostsToolSchema, async (args, _mcpContext) => {
        // Create context for the read posts tool
        const toolContext = {
            apiClient: context.apiClient,
        };
        return readPostsToolHandler(args, toolContext);
    });
    // Register the create_post tool
    server.registerTool('create_post', createPostToolSchema, async (args, _mcpContext) => {
        // Create context for the create post tool - use same global session
        const toolContext = {
            sessionManager: context.sessionManager,
            apiClient: context.apiClient,
            getSessionId: () => 'global-session',
        };
        return createPostToolHandler(args, toolContext);
    });
    logger.info('Tools registered', {
        count: 3,
        tools: ['login', 'read_posts', 'create_post'],
    });
}
//# sourceMappingURL=index.js.map