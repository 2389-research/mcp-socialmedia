import type { ApiClient } from './api-client.js';
import type { SessionManager } from './session-manager.js';
export interface HttpServerOptions {
    port?: number;
    host?: string;
    enableJsonResponse?: boolean;
    corsOrigin?: string;
}
export declare class HttpMcpServer {
    private readonly sessionManager;
    private readonly apiClient;
    private httpServer;
    private mcpServer;
    private transport;
    private readonly options;
    constructor(sessionManager: SessionManager, apiClient: ApiClient, options?: HttpServerOptions);
    /**
     * Start the HTTP server
     */
    start(): Promise<void>;
    /**
     * Stop the HTTP server
     */
    stop(): Promise<void>;
    /**
     * Handle incoming HTTP requests
     */
    private handleRequest;
    /**
     * Create the MCP server instance with HTTP transport
     */
    private createMcpServer;
    /**
     * Parse request body as JSON
     */
    private parseRequestBody;
}
//# sourceMappingURL=http-server.d.ts.map