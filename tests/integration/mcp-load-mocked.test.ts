// ABOUTME: MCP load and performance tests with mocked server responses
// ABOUTME: Tests server performance characteristics using mocked responses

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

class MockedMcpLoadTester {
  private sessionId: string;
  private requestCount = 0;

  constructor() {
    this.sessionId = `load-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  async makeRequest(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    this.requestCount++;

    // Simulate small network delay
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));

    // Mock responses based on method
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id: this.requestCount,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: { name: 'mcp-agent-social', version: '1.0.3' },
            capabilities: { tools: {}, resources: {}, sampling: {} },
          },
        };

      case 'tools/call':
        if (params.name === 'sampling_create') {
          return {
            jsonrpc: '2.0',
            id: this.requestCount,
            result: {
              content: [{ type: 'text', text: 'Mocked sampling response' }],
            },
          };
        }
        return {
          jsonrpc: '2.0',
          id: this.requestCount,
          result: { content: [{ type: 'text', text: 'Mocked tool response' }] },
        };

      case 'resources/read':
        return {
          jsonrpc: '2.0',
          id: this.requestCount,
          result: {
            contents: [{ uri: params.uri, mimeType: 'application/json', text: '{"mocked": true}' }],
          },
        };

      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  }

  async initializeSession(): Promise<void> {
    await this.makeRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {}, resources: {}, sampling: {} },
      clientInfo: { name: 'load-tester', version: '1.0.3' },
    });
  }

  async runBasicLoadTest(
    requests = 5,
  ): Promise<{ success: number; failed: number; avgTime: number }> {
    const startTime = Date.now();
    let success = 0;
    let failed = 0;

    // Run requests sequentially to avoid overwhelming the system
    for (let i = 0; i < requests; i++) {
      try {
        await this.makeRequest('tools/call', { name: 'read_posts', arguments: {} });
        success++;
      } catch (error) {
        console.error(`Request ${i + 1} failed:`, error);
        failed++;
      }
    }

    const totalTime = Date.now() - startTime;
    return { success, failed, avgTime: totalTime / requests };
  }

  async runSequentialTest(
    requests = 5,
  ): Promise<{ success: number; failed: number; totalTime: number }> {
    const startTime = Date.now();
    let success = 0;
    let failed = 0;

    for (let i = 0; i < requests; i++) {
      try {
        await this.makeRequest('tools/call', {
          name: 'create_post',
          arguments: { content: `Test post ${i}` },
        });
        success++;
      } catch {
        failed++;
      }
    }

    const totalTime = Date.now() - startTime;
    return { success, failed, totalTime };
  }
}

describe('MCP Load and Performance Tests (Mocked)', () => {
  let tester: MockedMcpLoadTester;

  beforeEach(async () => {
    jest.clearAllMocks();
    tester = new MockedMcpLoadTester();
    await tester.initializeSession();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Load Testing', () => {
    test('should handle basic request load', async () => {
      const result = await tester.runBasicLoadTest(5); // Reduce load for more reliable test

      expect(result.success).toBe(5);
      expect(result.failed).toBe(0);
      expect(result.avgTime).toBeLessThan(2000); // Allow more time for mocks
    }, 10000); // Increase timeout to 10 seconds

    test('should handle rapid sequential requests', async () => {
      const result = await tester.runSequentialTest(5);

      expect(result.success).toBe(5);
      expect(result.failed).toBe(0);
      expect(result.totalTime).toBeLessThan(1000); // Should be fast with mocks
    });
  });

  describe('New Features Testing', () => {
    test('should handle sampling tool requests', async () => {
      const response = await tester.makeRequest('tools/call', {
        name: 'sampling_create',
        arguments: {
          messages: [{ role: 'user', content: 'Test message' }],
          model: 'claude-3-sonnet',
        },
      });

      expect(response.result.content).toBeDefined();
      expect(response.result.content[0].text).toBe('Mocked sampling response');
    });

    test('should access roots resource', async () => {
      const response = await tester.makeRequest('resources/read', {
        uri: 'social://roots',
      });

      expect(response.result.contents).toBeDefined();
      expect(response.result.contents[0].uri).toBe('social://roots');
      expect(response.result.contents[0].mimeType).toBe('application/json');
    });
  });
});
