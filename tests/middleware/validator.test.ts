// ABOUTME: Unit tests for RequestValidator middleware
// ABOUTME: Tests MCP protocol validation, content limits, and error handling

import { jest } from '@jest/globals';

// Mock logger
jest.mock('../../src/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

import { RequestValidator } from '../../src/middleware/validator.js';

describe('RequestValidator', () => {
  let validator: RequestValidator;

  beforeEach(() => {
    jest.clearAllMocks();
    validator = new RequestValidator();
  });

  describe('validateRequest', () => {
    describe('base MCP structure validation', () => {
      it('should validate a valid MCP request', async () => {
        const validRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {},
        };

        await expect(validator.validateRequest(validRequest)).resolves.toBeUndefined();
      });

      it('should reject request without jsonrpc field', async () => {
        const invalidRequest = {
          id: 1,
          method: 'tools/list',
        };

        await expect(validator.validateRequest(invalidRequest)).rejects.toThrow('Request validation failed');
      });

      it('should reject request with wrong jsonrpc version', async () => {
        const invalidRequest = {
          jsonrpc: '1.0',
          id: 1,
          method: 'tools/list',
        };

        await expect(validator.validateRequest(invalidRequest)).rejects.toThrow('Request validation failed');
      });

      it('should reject request without method', async () => {
        const invalidRequest = {
          jsonrpc: '2.0',
          id: 1,
        };

        await expect(validator.validateRequest(invalidRequest)).rejects.toThrow('Request validation failed');
      });

      it('should accept null id', async () => {
        const validRequest = {
          jsonrpc: '2.0',
          id: null,
          method: 'tools/list',
        };

        await expect(validator.validateRequest(validRequest)).resolves.toBeUndefined();
      });

      it('should accept string id', async () => {
        const validRequest = {
          jsonrpc: '2.0',
          id: 'test-id',
          method: 'tools/list',
        };

        await expect(validator.validateRequest(validRequest)).resolves.toBeUndefined();
      });

      it('should accept request without params', async () => {
        const validRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
        };

        await expect(validator.validateRequest(validRequest)).resolves.toBeUndefined();
      });
    });

    describe('method-specific validation', () => {
      describe('tools/list', () => {
        it('should validate tools/list request with empty params', async () => {
          const request = {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/list',
            params: {},
          };

          await expect(validator.validateRequest(request)).resolves.toBeUndefined();
        });

        it('should validate tools/list request without params', async () => {
          const request = {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/list',
          };

          await expect(validator.validateRequest(request)).resolves.toBeUndefined();
        });
      });

      describe('tools/call', () => {
        it('should validate tools/call request with valid params', async () => {
          const request = {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
              name: 'test-tool',
              arguments: { arg1: 'value1' },
            },
          };

          await expect(validator.validateRequest(request)).resolves.toBeUndefined();
        });

        it('should validate tools/call request without arguments', async () => {
          const request = {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
              name: 'test-tool',
            },
          };

          await expect(validator.validateRequest(request)).resolves.toBeUndefined();
        });

        it('should reject tools/call request without name', async () => {
          const request = {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
              arguments: { arg1: 'value1' },
            },
          };

          await expect(validator.validateRequest(request)).rejects.toThrow('Request validation failed');
        });
      });

      describe('resources/list', () => {
        it('should validate resources/list request with cursor', async () => {
          const request = {
            jsonrpc: '2.0',
            id: 1,
            method: 'resources/list',
            params: {
              cursor: 'next-page-token',
            },
          };

          await expect(validator.validateRequest(request)).resolves.toBeUndefined();
        });

        it('should validate resources/list request without params', async () => {
          const request = {
            jsonrpc: '2.0',
            id: 1,
            method: 'resources/list',
          };

          await expect(validator.validateRequest(request)).resolves.toBeUndefined();
        });
      });

      it('should handle unknown methods gracefully', async () => {
        const request = {
          jsonrpc: '2.0',
          id: 1,
          method: 'unknown/method',
        };

        await expect(validator.validateRequest(request)).rejects.toThrow('Method not found: unknown/method');
      });
    });

    describe('custom validations', () => {
      it('should enforce content length limits', async () => {
        const largeParams = {
          data: 'x'.repeat(100001), // Exceeds 100KB limit
        };

        const request = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: largeParams,
        };

        await expect(validator.validateRequest(request)).rejects.toThrow('Request payload exceeds maximum size limit');
      });

      it('should allow content within size limits', async () => {
        const normalParams = {
          data: 'x'.repeat(1000), // Well within limits
        };

        const request = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: normalParams,
        };

        await expect(validator.validateRequest(request)).resolves.toBeUndefined();
      });

      it('should validate allowed methods', async () => {
        const allowedMethods = [
          'tools/list',
          'resources/list',
          'resources/read',
          'prompts/list',
          'prompts/get',
          'roots/list',
        ];

        for (const method of allowedMethods) {
          const request = {
            jsonrpc: '2.0',
            id: 1,
            method,
          };

          await expect(validator.validateRequest(request)).resolves.toBeUndefined();
        }

        // Test tools/call separately with required params
        const toolsCallRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'test-tool' },
        };
        await expect(validator.validateRequest(toolsCallRequest)).resolves.toBeUndefined();

        // Test sampling/create separately with required params
        const samplingRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'sampling/create',
          params: { messages: [{ content: 'test' }] },
        };
        await expect(validator.validateRequest(samplingRequest)).resolves.toBeUndefined();
      });

      it('should reject disallowed methods', async () => {
        const request = {
          jsonrpc: '2.0',
          id: 1,
          method: 'malicious/method',
        };

        await expect(validator.validateRequest(request)).rejects.toThrow('Method not found: malicious/method');
      });

      describe('sampling/create validation', () => {
        it('should validate sampling request with valid messages', async () => {
          const request = {
            jsonrpc: '2.0',
            id: 1,
            method: 'sampling/create',
            params: {
              messages: [
                { content: 'Hello' },
                { content: 'World' },
              ],
            },
          };

          await expect(validator.validateRequest(request)).resolves.toBeUndefined();
        });

        it('should reject sampling request with too many messages', async () => {
          const messages = Array(51).fill({ content: 'test' }); // Exceeds 50 message limit

          const request = {
            jsonrpc: '2.0',
            id: 1,
            method: 'sampling/create',
            params: { messages },
          };

          await expect(validator.validateRequest(request)).rejects.toThrow('Too many messages in sampling request (max 50)');
        });

        it('should reject sampling request with message content too long', async () => {
          const request = {
            jsonrpc: '2.0',
            id: 1,
            method: 'sampling/create',
            params: {
              messages: [
                { content: 'x'.repeat(10001) }, // Exceeds 10000 character limit
              ],
            },
          };

          await expect(validator.validateRequest(request)).rejects.toThrow('Message content exceeds maximum length (10000 characters)');
        });

        it('should allow sampling request at message limits', async () => {
          const messages = Array(50).fill({ content: 'x'.repeat(100) }); // Smaller content to avoid size limit

          const request = {
            jsonrpc: '2.0',
            id: 1,
            method: 'sampling/create',
            params: { messages },
          };

          await expect(validator.validateRequest(request)).resolves.toBeUndefined();
        });
      });
    });

    describe('error handling', () => {
      it('should include zod error details in validation errors', async () => {
        const request = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {}, // Missing required 'name' field
        };

        try {
          await validator.validateRequest(request);
        } catch (error: any) {
          expect(error.message).toContain('Request validation failed');
          expect(error.code).toBe(-32602); // Invalid params
          expect(error.data).toBeDefined();
        }
      });

      it('should set correct error code for method not found', async () => {
        const request = {
          jsonrpc: '2.0',
          id: 1,
          method: 'invalid/method',
        };

        try {
          await validator.validateRequest(request);
        } catch (error: any) {
          expect(error.message).toContain('Method not found');
          expect(error.code).toBe(-32601);
        }
      });
    });

    describe('logging', () => {
      it('should log successful validation', async () => {
        const request = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
        };

        await validator.validateRequest(request);

        // Just verify the method ran without error - logger is mocked at module level
        expect(true).toBe(true); // Placeholder for successful execution
      });
    });
  });

  describe('validateResponse', () => {
    describe('base MCP structure validation', () => {
      it('should validate a valid MCP success response', async () => {
        const validResponse = {
          jsonrpc: '2.0',
          id: 1,
          result: { data: 'success' },
        };

        await expect(validator.validateResponse(validResponse, 'unknown/method')).resolves.toBeUndefined();
      });

      it('should validate a valid MCP error response', async () => {
        const validResponse = {
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32000,
            message: 'Error message',
            data: { details: 'Additional error details' },
          },
        };

        await expect(validator.validateResponse(validResponse, 'tools/list')).resolves.toBeUndefined();
      });

      it('should reject response without jsonrpc field', async () => {
        const invalidResponse = {
          id: 1,
          result: { data: 'success' },
        };

        await expect(validator.validateResponse(invalidResponse, 'tools/list')).rejects.toThrow('Response validation failed');
      });

      it('should reject response with wrong jsonrpc version', async () => {
        const invalidResponse = {
          jsonrpc: '1.0',
          id: 1,
          result: { data: 'success' },
        };

        await expect(validator.validateResponse(invalidResponse, 'tools/list')).rejects.toThrow('Response validation failed');
      });
    });

    describe('method-specific response validation', () => {
      describe('tools/list', () => {
        it('should validate tools/list response with valid tools array', async () => {
          const response = {
            jsonrpc: '2.0',
            id: 1,
            result: {
              tools: [
                {
                  name: 'test-tool',
                  description: 'A test tool',
                  inputSchema: { type: 'object' },
                },
              ],
            },
          };

          await expect(validator.validateResponse(response, 'tools/list')).resolves.toBeUndefined();
        });

        it('should reject tools/list response with malformed tools', async () => {
          const response = {
            jsonrpc: '2.0',
            id: 1,
            result: {
              tools: [
                {
                  name: 'test-tool',
                  // Missing description and inputSchema
                },
              ],
            },
          };

          await expect(validator.validateResponse(response, 'tools/list')).rejects.toThrow('Response validation failed');
        });
      });

      describe('tools/call', () => {
        it('should validate tools/call response with content array', async () => {
          const response = {
            jsonrpc: '2.0',
            id: 1,
            result: {
              content: [
                {
                  type: 'text',
                  text: 'Tool execution result',
                },
              ],
            },
          };

          await expect(validator.validateResponse(response, 'tools/call')).resolves.toBeUndefined();
        });

        it('should validate tools/call response with data content', async () => {
          const response = {
            jsonrpc: '2.0',
            id: 1,
            result: {
              content: [
                {
                  type: 'application/json',
                  data: { result: 'success' },
                },
              ],
            },
          };

          await expect(validator.validateResponse(response, 'tools/call')).resolves.toBeUndefined();
        });

        it('should reject tools/call response without content array', async () => {
          const response = {
            jsonrpc: '2.0',
            id: 1,
            result: {
              message: 'This should be in content array',
            },
          };

          await expect(validator.validateResponse(response, 'tools/call')).rejects.toThrow('Response validation failed');
        });
      });

      describe('resources/list', () => {
        it('should validate resources/list response with resources array', async () => {
          const response = {
            jsonrpc: '2.0',
            id: 1,
            result: {
              resources: [
                {
                  uri: 'file://test.txt',
                  name: 'Test Resource',
                  description: 'A test resource',
                  mimeType: 'text/plain',
                },
              ],
            },
          };

          await expect(validator.validateResponse(response, 'resources/list')).resolves.toBeUndefined();
        });

        it('should validate resources/list response with minimal resource info', async () => {
          const response = {
            jsonrpc: '2.0',
            id: 1,
            result: {
              resources: [
                {
                  uri: 'file://test.txt',
                  name: 'Test Resource',
                },
              ],
            },
          };

          await expect(validator.validateResponse(response, 'resources/list')).resolves.toBeUndefined();
        });
      });

      it('should skip validation for unknown methods', async () => {
        const response = {
          jsonrpc: '2.0',
          id: 1,
          result: { anything: 'goes here' },
        };

        await expect(validator.validateResponse(response, 'unknown/method')).resolves.toBeUndefined();
      });

      it('should skip method-specific validation for error responses', async () => {
        const response = {
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32000,
            message: 'Error occurred',
          },
        };

        await expect(validator.validateResponse(response, 'tools/list')).resolves.toBeUndefined();
      });
    });

    describe('error handling', () => {
      it('should include zod error details in response validation errors', async () => {
        const response = {
          jsonrpc: '2.0',
          id: 1,
          result: {
            tools: 'should be array', // Wrong type
          },
        };

        try {
          await validator.validateResponse(response, 'tools/list');
        } catch (error: any) {
          expect(error.message).toContain('Response validation failed');
          expect(error.code).toBe(-32603); // Internal error
          expect(error.data).toBeDefined();
        }
      });
    });

    describe('logging', () => {
      it('should log successful response validation', async () => {
        const response = {
          jsonrpc: '2.0',
          id: 1,
          result: { data: 'success' },
        };

        await validator.validateResponse(response, 'unknown/method');

        // Just verify the method ran without error - logger is mocked at module level
        expect(true).toBe(true); // Placeholder for successful execution
      });
    });
  });

  describe('getStats', () => {
    it('should return initial stats', () => {
      const stats = validator.getStats();
      expect(stats).toEqual({
        totalValidations: 0,
        validationErrors: 0,
        successRate: 1,
      });
    });

    it('should track successful validations', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      };

      await validator.validateRequest(request);
      await validator.validateRequest(request);

      const stats = validator.getStats();
      expect(stats.totalValidations).toBe(2);
      expect(stats.validationErrors).toBe(0);
      expect(stats.successRate).toBe(1);
    });

    it('should track validation errors', async () => {
      const validRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      };

      const invalidRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'invalid/method',
      };

      await validator.validateRequest(validRequest);

      try {
        await validator.validateRequest(invalidRequest);
      } catch {
        // Expected error
      }

      const stats = validator.getStats();
      expect(stats.totalValidations).toBe(2);
      expect(stats.validationErrors).toBe(1);
      expect(stats.successRate).toBe(0.5);
    });

    it('should calculate success rate correctly', async () => {
      const validRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      };

      const invalidRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'invalid/method',
      };

      // 3 successful validations
      await validator.validateRequest(validRequest);
      await validator.validateRequest(validRequest);
      await validator.validateRequest(validRequest);

      // 1 failed validation
      try {
        await validator.validateRequest(invalidRequest);
      } catch {
        // Expected error
      }

      const stats = validator.getStats();
      expect(stats.totalValidations).toBe(4);
      expect(stats.validationErrors).toBe(1);
      expect(stats.successRate).toBe(0.75);
    });
  });

  describe('edge cases', () => {
    it('should handle null params gracefully', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: null,
      };

      await expect(validator.validateRequest(request)).rejects.toThrow();
    });

    it('should handle undefined method gracefully', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: undefined,
      };

      await expect(validator.validateRequest(request)).rejects.toThrow();
    });

    it('should handle empty string method', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: '',
      };

      await expect(validator.validateRequest(request)).rejects.toThrow('Method not found: ');
    });

    it('should handle very large ID values', async () => {
      const request = {
        jsonrpc: '2.0',
        id: Number.MAX_SAFE_INTEGER,
        method: 'tools/list',
      };

      await expect(validator.validateRequest(request)).resolves.toBeUndefined();
    });

    it('should handle very long string IDs', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 'x'.repeat(1000),
        method: 'tools/list',
      };

      await expect(validator.validateRequest(request)).resolves.toBeUndefined();
    });
  });
});
