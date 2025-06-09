// ABOUTME: HTTP server implementation for MCP social media server
// ABOUTME: Provides HTTP/SSE transport as an alternative to stdio

import { randomUUID } from 'node:crypto';
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { ApiClient } from './api-client.js';
import { config } from './config.js';
import { logger } from './logger.js';
import type { SessionManager } from './session-manager.js';

export interface HttpServerOptions {
  port?: number;
  host?: string;
  enableJsonResponse?: boolean;
  corsOrigin?: string;
}

export class HttpMcpServer {
  private httpServer: ReturnType<typeof createServer> | null = null;
  private mcpServers: Map<string, McpServer> = new Map();
  private readonly options: Required<HttpServerOptions>;

  constructor(
    private readonly sessionManager: SessionManager,
    private readonly apiClient: ApiClient,
    options: HttpServerOptions = {},
  ) {
    this.options = {
      port: options.port ?? 3000,
      host: options.host ?? 'localhost',
      enableJsonResponse: options.enableJsonResponse ?? false,
      corsOrigin: options.corsOrigin ?? '*',
    };
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    if (this.httpServer) {
      throw new Error('HTTP server already started');
    }

    this.httpServer = createServer(async (req, res) => {
      // Add CORS headers
      res.setHeader('Access-Control-Allow-Origin', this.options.corsOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-ID');
      res.setHeader('Access-Control-Max-Age', '86400');

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Log request
      logger.debug('HTTP request received', {
        method: req.method,
        url: req.url,
        headers: req.headers,
      });

      try {
        await this.handleRequest(req, res);
      } catch (error) {
        logger.error('Error handling HTTP request', { error });
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      }
    });

    return new Promise((resolve, reject) => {
      this.httpServer?.listen(this.options.port, this.options.host, () => {
        logger.info('HTTP MCP server started', {
          host: this.options.host,
          port: this.options.port,
          enableJsonResponse: this.options.enableJsonResponse,
        });
        resolve();
      });

      this.httpServer?.on('error', (error) => {
        logger.error('HTTP server error', { error });
        reject(error);
      });
    });
  }

  /**
   * Stop the HTTP server
   */
  async stop(): Promise<void> {
    if (!this.httpServer) {
      return;
    }

    // Close all MCP server connections
    for (const [sessionId, server] of this.mcpServers) {
      try {
        await server.close();
        logger.debug('Closed MCP server for session', { sessionId });
      } catch (error) {
        logger.error('Error closing MCP server', { sessionId, error });
      }
    }
    this.mcpServers.clear();

    // Close HTTP server
    return new Promise((resolve, reject) => {
      this.httpServer?.close((error) => {
        if (error) {
          logger.error('Error closing HTTP server', { error });
          reject(error);
        } else {
          logger.info('HTTP MCP server stopped');
          this.httpServer = null;
          resolve();
        }
      });
    });
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    // Only handle requests to /mcp endpoint
    if (url.pathname !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    // Get or create session
    const sessionId = (req.headers['x-session-id'] as string) || randomUUID();

    // Get or create MCP server for this session
    let mcpServer = this.mcpServers.get(sessionId);
    let transport: StreamableHTTPServerTransport | undefined;

    if (!mcpServer) {
      // Create new MCP server for this session
      const { server, transport: newTransport } = await this.createMcpServer(sessionId);
      mcpServer = server;
      transport = newTransport;
      this.mcpServers.set(sessionId, mcpServer);

      logger.info('Created new MCP server for session', { sessionId });
    } else {
      // Find existing transport
      transport = (mcpServer as any).__transport;
    }

    if (!transport) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Transport not found' }));
      return;
    }

    // Parse body if POST
    let body: unknown;
    if (req.method === 'POST') {
      body = await this.parseRequestBody(req);
    }

    // Let transport handle the request
    await transport.handleRequest(req, res, body);
  }

  /**
   * Create a new MCP server instance with HTTP transport
   */
  private async createMcpServer(sessionId: string): Promise<{
    server: McpServer;
    transport: StreamableHTTPServerTransport;
  }> {
    // Import the registration functions dynamically to avoid circular dependencies
    const { registerResources } = await import('./resources/index.js');
    const { registerPrompts } = await import('./prompts/index.js');
    const { registerTools } = await import('./tools/index.js');

    // Create MCP server
    const server = new McpServer({
      name: 'mcp-agent-social',
      version: '1.0.0',
    });

    // Create HTTP transport
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
      enableJsonResponse: this.options.enableJsonResponse,
      onsessioninitialized: (id) => {
        logger.debug('Session initialized', { sessionId: id });
      },
    });

    // Register all capabilities
    registerTools(server, { sessionManager: this.sessionManager, apiClient: this.apiClient });
    registerResources(server, { apiClient: this.apiClient, sessionManager: this.sessionManager });
    registerPrompts(server, { apiClient: this.apiClient, sessionManager: this.sessionManager });

    // Connect transport
    await server.connect(transport);

    // Store transport reference for later use
    (server as any).__transport = transport;

    return { server, transport };
  }

  /**
   * Parse request body as JSON
   */
  private async parseRequestBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : undefined);
        } catch (_error) {
          reject(new Error('Invalid JSON body'));
        }
      });
      req.on('error', reject);
    });
  }
}
