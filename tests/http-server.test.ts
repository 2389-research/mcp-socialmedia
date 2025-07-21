// ABOUTME: Unit tests for HttpMcpServer class with proper HTTP server mocking
// ABOUTME: Tests HTTP/SSE transport functionality with comprehensive mock setup

import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { jest } from '@jest/globals';

// Mock HTTP server implementation
class MockHttpServer extends EventEmitter {
  public listening = false;
  public callback: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;
  public port?: number;
  public host?: string;

  listen(port: number, host: string, callback?: () => void) {
    this.port = port;
    this.host = host;
    this.listening = true;

    // Simulate async behavior
    setImmediate(() => {
      if (callback) callback();
    });

    return this;
  }

  close(callback?: (err?: Error) => void) {
    this.listening = false;
    setImmediate(() => {
      if (callback) callback();
    });
    return this;
  }

  address() {
    return { port: this.port, address: this.host };
  }

  simulateRequest(req: IncomingMessage, res: ServerResponse) {
    if (this.callback) {
      this.callback(req, res);
    }
  }

  simulateError(error: Error) {
    this.emit('error', error);
  }
}

// Create mock instances
const mockHttpServer = new MockHttpServer();
mockHttpServer.setMaxListeners(20); // Prevent memory leak warnings
const mockMcpServer = {
  connect: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
};

const mockTransport = {
  handleRequest: jest.fn().mockResolvedValue(undefined),
};

// Mock node:http module
const mockCreateServer = jest.fn().mockImplementation((callback) => {
  mockHttpServer.callback = callback;
  return mockHttpServer;
});

// Use jest.unstable_mockModule for proper ES module mocking
jest.unstable_mockModule('node:http', () => ({
  createServer: mockCreateServer,
}));

// Mock MCP SDK modules
jest.unstable_mockModule('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => mockMcpServer),
}));

jest.unstable_mockModule('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: jest.fn().mockImplementation(() => mockTransport),
}));

// Mock logger
jest.unstable_mockModule('../src/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock crypto for UUID generation
jest.unstable_mockModule('node:crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('mock-uuid-123'),
}));

// Mock all the registration modules
jest.unstable_mockModule('../src/hooks/index.js', () => ({
  hooksManager: { mock: 'hooksManager' },
}));

jest.unstable_mockModule('../src/prompts/index.js', () => ({
  registerPrompts: jest.fn(),
}));

jest.unstable_mockModule('../src/resources/index.js', () => ({
  registerResources: jest.fn(),
}));

jest.unstable_mockModule('../src/roots/index.js', () => ({
  registerRoots: jest.fn(),
}));

jest.unstable_mockModule('../src/tools/index.js', () => ({
  registerTools: jest.fn(),
}));

jest.unstable_mockModule('../src/config.js', () => ({
  version: '1.1.0',
}));

// Now import the modules
const { HttpMcpServer } = await import('../src/http-server.js');
const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = await import(
  '@modelcontextprotocol/sdk/server/streamableHttp.js'
);

import type { ApiClient } from '../src/api-client.js';
import type { HttpServerOptions } from '../src/http-server.js';
import type { SessionManager } from '../src/session-manager.js';

describe('HttpMcpServer', () => {
  let httpServer: HttpMcpServer;
  let mockSessionManager: jest.Mocked<SessionManager>;
  let mockApiClient: jest.Mocked<ApiClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock server state
    mockHttpServer.listening = false;
    mockHttpServer.callback = null;
    mockHttpServer.port = undefined;
    mockHttpServer.host = undefined;

    // Reset listen method to original implementation
    mockHttpServer.listen = function (port: number, host: string, callback?: () => void) {
      this.port = port;
      this.host = host;
      this.listening = true;

      setImmediate(() => {
        if (callback) callback();
      });

      return this;
    };

    // Reset close method to original implementation
    mockHttpServer.close = function (callback?: (err?: Error) => void) {
      this.listening = false;
      setImmediate(() => {
        if (callback) callback();
      });
      return this;
    };

    // Reset mock implementations
    jest.mocked(mockMcpServer.connect).mockResolvedValue(undefined);
    jest.mocked(mockMcpServer.close).mockResolvedValue(undefined);
    jest.mocked(mockTransport.handleRequest).mockResolvedValue(undefined);

    mockSessionManager = {} as jest.Mocked<SessionManager>;
    mockApiClient = {} as jest.Mocked<ApiClient>;
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      httpServer = new HttpMcpServer(mockSessionManager, mockApiClient);
      expect(httpServer).toBeInstanceOf(HttpMcpServer);
    });

    it('should initialize with custom options', () => {
      const options: HttpServerOptions = {
        port: 8080,
        host: '0.0.0.0',
        enableJsonResponse: true,
        corsOrigin: 'https://example.com',
      };

      httpServer = new HttpMcpServer(mockSessionManager, mockApiClient, options);
      expect(httpServer).toBeInstanceOf(HttpMcpServer);
    });
  });

  describe('start()', () => {
    beforeEach(() => {
      httpServer = new HttpMcpServer(mockSessionManager, mockApiClient);
    });

    it('should start the HTTP server successfully', async () => {
      await httpServer.start();

      expect(mockCreateServer).toHaveBeenCalledWith(expect.any(Function));
      expect(mockHttpServer.listening).toBe(true);
      expect(mockHttpServer.port).toBe(3000); // default port
      expect(mockHttpServer.host).toBe('localhost'); // default host
      expect(jest.mocked(mockMcpServer.connect)).toHaveBeenCalledWith(mockTransport);
    });

    it('should start with custom port and host', async () => {
      const options: HttpServerOptions = {
        port: 8080,
        host: '0.0.0.0',
      };

      httpServer = new HttpMcpServer(mockSessionManager, mockApiClient, options);
      await httpServer.start();

      expect(mockHttpServer.port).toBe(8080);
      expect(mockHttpServer.host).toBe('0.0.0.0');
    });

    it('should throw error if server already started', async () => {
      await httpServer.start();

      await expect(httpServer.start()).rejects.toThrow('HTTP server already started');
    });

    it('should handle server listen errors', async () => {
      // Override the listen method to simulate an error
      const originalListen = mockHttpServer.listen;
      mockHttpServer.listen = jest.fn().mockImplementation(() => {
        setImmediate(() => {
          mockHttpServer.emit('error', new Error('Port already in use'));
        });
        return mockHttpServer;
      });

      await expect(httpServer.start()).rejects.toThrow('Port already in use');

      // Restore original method
      mockHttpServer.listen = originalListen;
    });

    it('should create MCP server with correct configuration', async () => {
      await httpServer.start();

      expect(McpServer).toHaveBeenCalledWith({
        name: 'mcp-agent-social',
        version: '1.1.0',
      });
    });

    it('should create transport with correct options', async () => {
      const options: HttpServerOptions = {
        enableJsonResponse: true,
      };

      httpServer = new HttpMcpServer(mockSessionManager, mockApiClient, options);
      await httpServer.start();

      expect(StreamableHTTPServerTransport).toHaveBeenCalledWith({
        sessionIdGenerator: expect.any(Function),
        enableJsonResponse: true,
        onsessioninitialized: expect.any(Function),
      });
    });
  });

  describe('stop()', () => {
    beforeEach(() => {
      httpServer = new HttpMcpServer(mockSessionManager, mockApiClient);
    });

    it('should stop gracefully when not started', async () => {
      await expect(httpServer.stop()).resolves.toBeUndefined();
    });

    it('should stop the HTTP server successfully', async () => {
      await httpServer.start();
      await httpServer.stop();

      expect(jest.mocked(mockMcpServer.close)).toHaveBeenCalled();
      expect(mockHttpServer.listening).toBe(false);
    });

    it('should handle MCP server close errors gracefully', async () => {
      jest.mocked(mockMcpServer.close).mockRejectedValue(new Error('Close error'));

      await httpServer.start();
      await httpServer.stop(); // Should not throw

      expect(jest.mocked(mockMcpServer.close)).toHaveBeenCalled();
    });

    it('should handle HTTP server close errors', async () => {
      // Override close to simulate error
      const originalClose = mockHttpServer.close;
      mockHttpServer.close = jest.fn().mockImplementation((callback) => {
        if (callback) {
          setImmediate(() => callback(new Error('Close error')));
        }
        return mockHttpServer;
      });

      await httpServer.start();
      await expect(httpServer.stop()).rejects.toThrow('Close error');

      // Restore original method
      mockHttpServer.close = originalClose;
    });
  });

  describe('request handling', () => {
    let mockReq: Partial<IncomingMessage>;
    let mockRes: Partial<ServerResponse>;

    beforeEach(async () => {
      httpServer = new HttpMcpServer(mockSessionManager, mockApiClient);
      await httpServer.start();

      mockReq = {
        method: 'POST',
        url: '/mcp',
        headers: {
          host: 'localhost:3000',
          'content-type': 'application/json',
        },
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            // Don't call callback immediately for body parsing tests
          } else if (event === 'end') {
            setImmediate(callback);
          }
        }),
      };

      mockRes = {
        setHeader: jest.fn(),
        writeHead: jest.fn(),
        end: jest.fn(),
        headersSent: false,
      };
    });

    it('should handle CORS preflight requests', async () => {
      mockReq.method = 'OPTIONS';

      mockHttpServer.simulateRequest(mockReq as IncomingMessage, mockRes as ServerResponse);

      // Allow async handling to complete
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Methods',
        'GET, POST, DELETE, OPTIONS',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Headers',
        'Content-Type, Mcp-Session-Id',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Max-Age', '86400');
      expect(mockRes.writeHead).toHaveBeenCalledWith(204);
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should handle custom CORS origin', async () => {
      await httpServer.stop();

      const options: HttpServerOptions = {
        corsOrigin: 'https://example.com',
      };

      httpServer = new HttpMcpServer(mockSessionManager, mockApiClient, options);
      await httpServer.start();

      mockHttpServer.simulateRequest(mockReq as IncomingMessage, mockRes as ServerResponse);
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://example.com',
      );
    });

    it('should return 404 for non-/mcp endpoints', async () => {
      mockReq.url = '/other';

      mockHttpServer.simulateRequest(mockReq as IncomingMessage, mockRes as ServerResponse);
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Not found' }));
    });

    it('should generate session ID when not provided', async () => {
      mockHttpServer.simulateRequest(mockReq as IncomingMessage, mockRes as ServerResponse);
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockRes.setHeader).toHaveBeenCalledWith('Mcp-Session-Id', 'mock-uuid-123');
    });

    it('should use provided session ID', async () => {
      mockReq.headers = {
        ...mockReq.headers,
        'mcp-session-id': 'test-session-123',
      };

      mockHttpServer.simulateRequest(mockReq as IncomingMessage, mockRes as ServerResponse);
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockRes.setHeader).toHaveBeenCalledWith('Mcp-Session-Id', 'test-session-123');
    });

    it('should delegate to transport for valid requests', async () => {
      mockHttpServer.simulateRequest(mockReq as IncomingMessage, mockRes as ServerResponse);
      await new Promise((resolve) => setImmediate(resolve));

      expect(jest.mocked(mockTransport.handleRequest)).toHaveBeenCalledWith(
        mockReq,
        mockRes,
        undefined, // No body for this test
      );
    });

    it('should handle transport errors gracefully', async () => {
      jest.mocked(mockTransport.handleRequest).mockRejectedValue(new Error('Transport error'));

      mockHttpServer.simulateRequest(mockReq as IncomingMessage, mockRes as ServerResponse);
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockRes.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' });
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Internal server error' }));
    });

    it('should not write headers if already sent', async () => {
      jest.mocked(mockTransport.handleRequest).mockRejectedValue(new Error('Transport error'));
      mockRes.headersSent = true;

      mockHttpServer.simulateRequest(mockReq as IncomingMessage, mockRes as ServerResponse);
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockRes.writeHead).not.toHaveBeenCalled();
      expect(mockRes.end).not.toHaveBeenCalled();
    });

    it('should handle missing transport gracefully', async () => {
      // Force transport to be null
      (httpServer as unknown as { transport: null }).transport = null;

      mockHttpServer.simulateRequest(mockReq as IncomingMessage, mockRes as ServerResponse);
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockRes.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' });
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Transport not found' }));
    });
  });

  describe('parseRequestBody', () => {
    beforeEach(async () => {
      httpServer = new HttpMcpServer(mockSessionManager, mockApiClient);
      await httpServer.start();
    });

    it('should parse valid JSON body', async () => {
      const mockReq = new EventEmitter() as IncomingMessage;
      const testData = { test: 'data' };

      setImmediate(() => {
        mockReq.emit('data', JSON.stringify(testData));
        mockReq.emit('end');
      });

      // Access the private method through reflection for testing
      const parseRequestBody = (
        httpServer as unknown as { parseRequestBody: (req: IncomingMessage) => Promise<unknown> }
      ).parseRequestBody.bind(httpServer);
      const result = await parseRequestBody(mockReq);

      expect(result).toEqual(testData);
    });

    it('should handle empty body', async () => {
      const mockReq = new EventEmitter() as IncomingMessage;

      setImmediate(() => {
        mockReq.emit('end');
      });

      const parseRequestBody = (
        httpServer as unknown as { parseRequestBody: (req: IncomingMessage) => Promise<unknown> }
      ).parseRequestBody.bind(httpServer);
      const result = await parseRequestBody(mockReq);

      expect(result).toBeUndefined();
    });

    it('should reject invalid JSON', async () => {
      const mockReq = new EventEmitter() as IncomingMessage;

      setImmediate(() => {
        mockReq.emit('data', 'invalid json');
        mockReq.emit('end');
      });

      const parseRequestBody = (
        httpServer as unknown as { parseRequestBody: (req: IncomingMessage) => Promise<unknown> }
      ).parseRequestBody.bind(httpServer);
      await expect(parseRequestBody(mockReq)).rejects.toThrow('Invalid JSON body');
    });

    it('should handle request errors', async () => {
      const mockReq = new EventEmitter() as IncomingMessage;
      const testError = new Error('Request error');

      setImmediate(() => {
        mockReq.emit('error', testError);
      });

      const parseRequestBody = (
        httpServer as unknown as { parseRequestBody: (req: IncomingMessage) => Promise<unknown> }
      ).parseRequestBody.bind(httpServer);
      await expect(parseRequestBody(mockReq)).rejects.toThrow('Request error');
    });

    it('should handle chunked data', async () => {
      const mockReq = new EventEmitter() as IncomingMessage;
      const testData = { large: 'data' };
      const jsonString = JSON.stringify(testData);
      const chunk1 = jsonString.slice(0, 5);
      const chunk2 = jsonString.slice(5);

      setImmediate(() => {
        mockReq.emit('data', chunk1);
        mockReq.emit('data', chunk2);
        mockReq.emit('end');
      });

      const parseRequestBody = (
        httpServer as unknown as { parseRequestBody: (req: IncomingMessage) => Promise<unknown> }
      ).parseRequestBody.bind(httpServer);
      const result = await parseRequestBody(mockReq);

      expect(result).toEqual(testData);
    });
  });

  describe('error scenarios', () => {
    beforeEach(() => {
      httpServer = new HttpMcpServer(mockSessionManager, mockApiClient);
    });

    it('should handle port already in use error', async () => {
      const portError = new Error('EADDRINUSE: Address already in use');
      (portError as unknown as { code: string }).code = 'EADDRINUSE';

      // Override listen to simulate port conflict
      mockHttpServer.listen = jest.fn().mockImplementation(() => {
        setImmediate(() => {
          mockHttpServer.emit('error', portError);
        });
        return mockHttpServer;
      });

      await expect(httpServer.start()).rejects.toThrow('EADDRINUSE: Address already in use');
    });

    it('should handle various server errors', async () => {
      const errors = [
        new Error('EACCES: Permission denied'),
        new Error('ENOTFOUND: Host not found'),
        new Error('Generic server error'),
      ];

      for (const error of errors) {
        // Reset server for each test
        httpServer = new HttpMcpServer(mockSessionManager, mockApiClient);

        mockHttpServer.listen = jest.fn().mockImplementation(() => {
          setImmediate(() => {
            mockHttpServer.emit('error', error);
          });
          return mockHttpServer;
        });

        await expect(httpServer.start()).rejects.toThrow(error.message);
      }
    });

    it('should cleanup properly on failed start', async () => {
      jest.mocked(mockMcpServer.connect).mockRejectedValue(new Error('MCP connection failed'));

      await expect(httpServer.start()).rejects.toThrow('MCP connection failed');

      // Verify MCP server was created but connection failed
      expect(McpServer).toHaveBeenCalled();
      expect(mockMcpServer.connect).toHaveBeenCalled();
    });
  });

  describe('integration tests', () => {
    it('should handle server lifecycle correctly', async () => {
      httpServer = new HttpMcpServer(mockSessionManager, mockApiClient, {
        port: 9999,
        host: '127.0.0.1',
        enableJsonResponse: true,
        corsOrigin: 'https://test.com',
      });

      // Test start
      await httpServer.start();
      expect(mockHttpServer.listening).toBe(true);
      expect(mockHttpServer.port).toBe(9999);
      expect(mockHttpServer.host).toBe('127.0.0.1');

      // Test stop
      await httpServer.stop();
      expect(mockHttpServer.listening).toBe(false);
    });

    it('should handle start/stop cycles correctly', async () => {
      httpServer = new HttpMcpServer(mockSessionManager, mockApiClient);

      // First cycle
      await httpServer.start();
      expect(mockHttpServer.listening).toBe(true);
      await httpServer.stop();
      expect(mockHttpServer.listening).toBe(false);

      // Second cycle - should work without issues
      await httpServer.start();
      expect(mockHttpServer.listening).toBe(true);
      await httpServer.stop();
      expect(mockHttpServer.listening).toBe(false);
    });
  });
});
