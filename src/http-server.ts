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
  private mcpServer: McpServer | null = null;
  private transport: StreamableHTTPServerTransport | null = null;
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

    // Create single MCP server instance
    await this.createMcpServer();

    this.httpServer = createServer(async (req, res) => {
      // Add CORS headers
      res.setHeader('Access-Control-Allow-Origin', this.options.corsOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id');
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

    // Close MCP server connection
    if (this.mcpServer) {
      try {
        await this.mcpServer.close();
        logger.debug('Closed MCP server');
      } catch (error) {
        logger.error('Error closing MCP server', { error });
      }
      this.mcpServer = null;
      this.transport = null;
    }

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

    // Get or create session ID
    const sessionId = (req.headers['mcp-session-id'] as string) || randomUUID();

    // Set session ID in response header for client tracking
    res.setHeader('Mcp-Session-Id', sessionId);

    if (!this.transport) {
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
    await this.transport.handleRequest(req, res, body);
  }

  /**
   * Create the MCP server instance with HTTP transport
   */
  private async createMcpServer(): Promise<void> {
    // Import the registration functions dynamically to avoid circular dependencies
    const { hooksManager } = await import('./hooks/index.js');
    const { registerPrompts } = await import('./prompts/index.js');
    const { registerResources } = await import('./resources/index.js');
    const { registerRoots } = await import('./roots/index.js');
    const { registerSampling } = await import('./sampling/index.js');
    const { registerTools } = await import('./tools/index.js');

    // Create MCP server
    this.mcpServer = new McpServer({
      name: 'mcp-agent-social',
      version: '1.0.3',
    });

    // Create HTTP transport
    this.transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      enableJsonResponse: this.options.enableJsonResponse,
      onsessioninitialized: (id) => {
        logger.debug('Session initialized', { sessionId: id });
      },
    });

    // Register all capabilities
    registerTools(this.mcpServer, { sessionManager: this.sessionManager, apiClient: this.apiClient, hooksManager });
    registerResources(this.mcpServer, { apiClient: this.apiClient, sessionManager: this.sessionManager, hooksManager });
    registerPrompts(this.mcpServer, { apiClient: this.apiClient, sessionManager: this.sessionManager, hooksManager });
    registerSampling(this.mcpServer, { apiClient: this.apiClient, sessionManager: this.sessionManager, hooksManager });
    registerRoots(this.mcpServer, { apiClient: this.apiClient, sessionManager: this.sessionManager, hooksManager });

    // Connect transport
    await this.mcpServer.connect(this.transport);
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
