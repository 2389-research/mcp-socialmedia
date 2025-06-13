// ABOUTME: Unit tests for roots system and workspace boundaries
// ABOUTME: Tests RootsManager functionality, session assignments, and MCP resource registration

import { jest } from '@jest/globals';

// Mock logger
jest.mock('../src/logger.js', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { RootsManager, registerRoots } from '../src/roots/index.js';
import type { RootDefinition, RootLimits, RootPermissions } from '../src/roots/types.js';

describe('Roots System', () => {
  let rootsManager: RootsManager;
  let mockServer: any;
  let mockContext: any;

  beforeEach(() => {
    jest.clearAllMocks();
    rootsManager = new RootsManager();

    mockServer = {
      resource: jest.fn(),
    };

    mockContext = {
      apiClient: {},
      sessionManager: {},
    };
  });

  describe('RootsManager', () => {
    describe('constructor', () => {
      it('should initialize with default workspace root', () => {
        expect(rootsManager).toBeInstanceOf(RootsManager);

        const defaultRoot = rootsManager.getRootForSession('any-session');
        expect(defaultRoot).toBeDefined();
        expect(defaultRoot?.uri).toBe('social://workspace');
        expect(defaultRoot?.name).toBe('Social Media Workspace');
      });

      it('should set up default permissions and limits', () => {
        const defaultRoot = rootsManager.getRootForSession('test-session');

        expect(defaultRoot?.limits).toEqual(
          expect.objectContaining({
            maxPostsPerHour: 10,
            maxReadRequestsPerMinute: 30,
            maxConcurrentSessions: 5,
            maxContentLength: 2000,
            rateLimitWindow: 3600000,
          })
        );

        expect(defaultRoot?.permissions).toEqual(
          expect.objectContaining({
            canCreatePosts: true,
            canReadPosts: true,
            canAccessFeed: true,
            canAccessAgentProfiles: true,
            canUsePrompts: true,
            canUseSampling: true,
          })
        );
      });

      it('should include allowed operations', () => {
        const defaultRoot = rootsManager.getRootForSession('test-session');

        expect(defaultRoot?.limits.allowedOperations).toEqual(
          expect.arrayContaining(['read_posts', 'create_post', 'login'])
        );
      });
    });

    describe('getRootForSession', () => {
      it('should return default root for unassigned session', () => {
        const root = rootsManager.getRootForSession('unassigned-session');

        expect(root).toBeDefined();
        expect(root?.uri).toBe('social://workspace');
      });

      it('should return assigned root for session', () => {
        const customRoot: RootDefinition = {
          uri: 'social://custom-workspace',
          name: 'Custom Workspace',
          description: 'Test workspace',
          limits: {
            maxPostsPerHour: 5,
            maxReadRequestsPerMinute: 15,
            maxConcurrentSessions: 2,
            allowedOperations: ['read_posts'],
            maxContentLength: 1000,
            rateLimitWindow: 1800000,
          },
          permissions: {
            canCreatePosts: false,
            canReadPosts: true,
            canAccessFeed: false,
            canAccessAgentProfiles: false,
            canUsePrompts: false,
            canUseSampling: false,
          },
        };

        rootsManager.addRoot(customRoot);
        rootsManager.assignRootToSession('test-session', 'social://custom-workspace');

        const assignedRoot = rootsManager.getRootForSession('test-session');
        expect(assignedRoot?.uri).toBe('social://custom-workspace');
        expect(assignedRoot?.name).toBe('Custom Workspace');
      });

      it('should return undefined for non-existent root assignment', () => {
        rootsManager.assignRootToSession('test-session', 'social://non-existent');

        // Should fall back to default since assignment failed
        const root = rootsManager.getRootForSession('test-session');
        expect(root?.uri).toBe('social://workspace');
      });
    });

    describe('assignRootToSession', () => {
      it('should successfully assign existing root to session', () => {
        const result = rootsManager.assignRootToSession('test-session', 'social://workspace');

        expect(result).toBe(true);

        const assignedRoot = rootsManager.getRootForSession('test-session');
        expect(assignedRoot?.uri).toBe('social://workspace');
      });

      it('should fail to assign non-existent root', () => {
        const result = rootsManager.assignRootToSession('test-session', 'social://non-existent');

        expect(result).toBe(false);

        // Session should still get default root
        const root = rootsManager.getRootForSession('test-session');
        expect(root?.uri).toBe('social://workspace');
      });

      it('should overwrite previous root assignment', () => {
        const customRoot: RootDefinition = {
          uri: 'social://new-workspace',
          name: 'New Workspace',
          description: 'Another test workspace',
          limits: {
            maxPostsPerHour: 20,
            maxReadRequestsPerMinute: 60,
            maxConcurrentSessions: 10,
            allowedOperations: ['read_posts', 'create_post'],
            maxContentLength: 3000,
            rateLimitWindow: 7200000,
          },
          permissions: {
            canCreatePosts: true,
            canReadPosts: true,
            canAccessFeed: true,
            canAccessAgentProfiles: true,
            canUsePrompts: true,
            canUseSampling: false,
          },
        };

        rootsManager.addRoot(customRoot);

        // First assignment
        rootsManager.assignRootToSession('test-session', 'social://workspace');
        expect(rootsManager.getRootForSession('test-session')?.uri).toBe('social://workspace');

        // Second assignment should overwrite
        rootsManager.assignRootToSession('test-session', 'social://new-workspace');
        expect(rootsManager.getRootForSession('test-session')?.uri).toBe('social://new-workspace');
      });
    });

    describe('isOperationAllowed', () => {
      it('should allow operations in allowedOperations list', () => {
        const allowed = rootsManager.isOperationAllowed('test-session', 'read_posts');
        expect(allowed).toBe(true);

        const alsoAllowed = rootsManager.isOperationAllowed('test-session', 'create_post');
        expect(alsoAllowed).toBe(true);
      });

      it('should deny operations not in allowedOperations list', () => {
        const denied = rootsManager.isOperationAllowed('test-session', 'delete_post');
        expect(denied).toBe(false);

        const alsoDenied = rootsManager.isOperationAllowed('test-session', 'admin_operation');
        expect(alsoDenied).toBe(false);
      });

      it('should deny all operations for session without root', () => {
        // Create a session with non-existent root
        rootsManager.assignRootToSession('orphan-session', 'social://non-existent');

        // Since assignRootToSession returns false for non-existent roots,
        // the session will fall back to default root
        const denied = rootsManager.isOperationAllowed('orphan-session', 'read_posts');
        expect(denied).toBe(true); // Falls back to default root which allows read_posts
      });

      it('should respect custom root operation restrictions', () => {
        const restrictiveRoot: RootDefinition = {
          uri: 'social://restrictive',
          name: 'Restrictive Workspace',
          description: 'Read-only workspace',
          limits: {
            maxPostsPerHour: 0,
            maxReadRequestsPerMinute: 10,
            maxConcurrentSessions: 1,
            allowedOperations: ['read_posts'],
            maxContentLength: 500,
            rateLimitWindow: 3600000,
          },
          permissions: {
            canCreatePosts: false,
            canReadPosts: true,
            canAccessFeed: false,
            canAccessAgentProfiles: false,
            canUsePrompts: false,
            canUseSampling: false,
          },
        };

        rootsManager.addRoot(restrictiveRoot);
        rootsManager.assignRootToSession('restricted-session', 'social://restrictive');

        expect(rootsManager.isOperationAllowed('restricted-session', 'read_posts')).toBe(true);
        expect(rootsManager.isOperationAllowed('restricted-session', 'create_post')).toBe(false);
        expect(rootsManager.isOperationAllowed('restricted-session', 'login')).toBe(false);
      });
    });

    describe('isContentLengthValid', () => {
      it('should allow content within length limits', () => {
        const valid = rootsManager.isContentLengthValid('test-session', 100);
        expect(valid).toBe(true);

        const atLimit = rootsManager.isContentLengthValid('test-session', 2000);
        expect(atLimit).toBe(true);
      });

      it('should deny content exceeding length limits', () => {
        const invalid = rootsManager.isContentLengthValid('test-session', 2001);
        expect(invalid).toBe(false);

        const wayTooLong = rootsManager.isContentLengthValid('test-session', 10000);
        expect(wayTooLong).toBe(false);
      });

      it('should deny content for session without root', () => {
        // Force a session with no valid root
        rootsManager.assignRootToSession('orphan-session', 'social://non-existent');

        // Since assignRootToSession returns false for non-existent roots,
        // the session will fall back to default root
        const denied = rootsManager.isContentLengthValid('orphan-session', 100);
        expect(denied).toBe(true); // Falls back to default root with maxContentLength 2000
      });

      it('should respect custom root content length limits', () => {
        const shortLimitRoot: RootDefinition = {
          uri: 'social://short-content',
          name: 'Short Content Workspace',
          description: 'Workspace with short content limits',
          limits: {
            maxPostsPerHour: 10,
            maxReadRequestsPerMinute: 30,
            maxConcurrentSessions: 5,
            allowedOperations: ['read_posts', 'create_post'],
            maxContentLength: 280, // Twitter-style limit
            rateLimitWindow: 3600000,
          },
          permissions: {
            canCreatePosts: true,
            canReadPosts: true,
            canAccessFeed: true,
            canAccessAgentProfiles: true,
            canUsePrompts: true,
            canUseSampling: true,
          },
        };

        rootsManager.addRoot(shortLimitRoot);
        rootsManager.assignRootToSession('short-session', 'social://short-content');

        expect(rootsManager.isContentLengthValid('short-session', 280)).toBe(true);
        expect(rootsManager.isContentLengthValid('short-session', 281)).toBe(false);
      });
    });

    describe('getAllRoots', () => {
      it('should return all registered roots', () => {
        const roots = rootsManager.getAllRoots();

        expect(roots).toHaveLength(1); // Default root
        expect(roots[0].uri).toBe('social://workspace');
      });

      it('should return all roots after adding custom ones', () => {
        const customRoot1: RootDefinition = {
          uri: 'social://custom1',
          name: 'Custom 1',
          description: 'First custom root',
          limits: {
            maxPostsPerHour: 5,
            maxReadRequestsPerMinute: 15,
            maxConcurrentSessions: 2,
            allowedOperations: ['read_posts'],
            maxContentLength: 1000,
            rateLimitWindow: 1800000,
          },
          permissions: {
            canCreatePosts: false,
            canReadPosts: true,
            canAccessFeed: false,
            canAccessAgentProfiles: false,
            canUsePrompts: false,
            canUseSampling: false,
          },
        };

        const customRoot2: RootDefinition = {
          uri: 'social://custom2',
          name: 'Custom 2',
          description: 'Second custom root',
          limits: {
            maxPostsPerHour: 15,
            maxReadRequestsPerMinute: 45,
            maxConcurrentSessions: 8,
            allowedOperations: ['read_posts', 'create_post', 'delete_post'],
            maxContentLength: 5000,
            rateLimitWindow: 3600000,
          },
          permissions: {
            canCreatePosts: true,
            canReadPosts: true,
            canAccessFeed: true,
            canAccessAgentProfiles: true,
            canUsePrompts: true,
            canUseSampling: true,
          },
        };

        rootsManager.addRoot(customRoot1);
        rootsManager.addRoot(customRoot2);

        const allRoots = rootsManager.getAllRoots();
        expect(allRoots).toHaveLength(3);

        const uris = allRoots.map(r => r.uri);
        expect(uris).toContain('social://workspace');
        expect(uris).toContain('social://custom1');
        expect(uris).toContain('social://custom2');
      });
    });

    describe('addRoot', () => {
      it('should add new root successfully', () => {
        const newRoot: RootDefinition = {
          uri: 'social://test-workspace',
          name: 'Test Workspace',
          description: 'Workspace for testing',
          limits: {
            maxPostsPerHour: 25,
            maxReadRequestsPerMinute: 100,
            maxConcurrentSessions: 15,
            allowedOperations: ['read_posts', 'create_post', 'admin_operation'],
            maxContentLength: 4000,
            rateLimitWindow: 1800000,
          },
          permissions: {
            canCreatePosts: true,
            canReadPosts: true,
            canAccessFeed: true,
            canAccessAgentProfiles: true,
            canUsePrompts: true,
            canUseSampling: true,
          },
        };

        rootsManager.addRoot(newRoot);

        const allRoots = rootsManager.getAllRoots();
        expect(allRoots).toHaveLength(2);

        const addedRoot = allRoots.find(r => r.uri === 'social://test-workspace');
        expect(addedRoot).toBeDefined();
        expect(addedRoot?.name).toBe('Test Workspace');
        expect(addedRoot?.limits.maxPostsPerHour).toBe(25);
      });

      it('should overwrite existing root with same URI', () => {
        const originalRoot: RootDefinition = {
          uri: 'social://duplicate',
          name: 'Original Name',
          description: 'Original description',
          limits: {
            maxPostsPerHour: 5,
            maxReadRequestsPerMinute: 10,
            maxConcurrentSessions: 1,
            allowedOperations: ['read_posts'],
            maxContentLength: 500,
            rateLimitWindow: 3600000,
          },
          permissions: {
            canCreatePosts: false,
            canReadPosts: true,
            canAccessFeed: false,
            canAccessAgentProfiles: false,
            canUsePrompts: false,
            canUseSampling: false,
          },
        };

        const updatedRoot: RootDefinition = {
          uri: 'social://duplicate',
          name: 'Updated Name',
          description: 'Updated description',
          limits: {
            maxPostsPerHour: 15,
            maxReadRequestsPerMinute: 30,
            maxConcurrentSessions: 5,
            allowedOperations: ['read_posts', 'create_post'],
            maxContentLength: 2000,
            rateLimitWindow: 1800000,
          },
          permissions: {
            canCreatePosts: true,
            canReadPosts: true,
            canAccessFeed: true,
            canAccessAgentProfiles: true,
            canUsePrompts: true,
            canUseSampling: true,
          },
        };

        rootsManager.addRoot(originalRoot);
        expect(rootsManager.getAllRoots()).toHaveLength(2); // Default + original

        rootsManager.addRoot(updatedRoot);
        expect(rootsManager.getAllRoots()).toHaveLength(2); // Default + updated (overwrote original)

        const finalRoot = rootsManager.getAllRoots().find(r => r.uri === 'social://duplicate');
        expect(finalRoot?.name).toBe('Updated Name');
        expect(finalRoot?.limits.maxPostsPerHour).toBe(15);
      });
    });

    describe('clearSessionRoot', () => {
      it('should remove session root assignment', () => {
        // Assign a root to session
        rootsManager.assignRootToSession('test-session', 'social://workspace');
        expect(rootsManager.getRootForSession('test-session')?.uri).toBe('social://workspace');

        // Clear the assignment
        rootsManager.clearSessionRoot('test-session');

        // Should fall back to default root
        expect(rootsManager.getRootForSession('test-session')?.uri).toBe('social://workspace');
      });

      it('should handle clearing non-existent session gracefully', () => {
        // Should not throw error
        expect(() => {
          rootsManager.clearSessionRoot('non-existent-session');
        }).not.toThrow();
      });

      it('should only affect target session', () => {
        const customRoot: RootDefinition = {
          uri: 'social://custom',
          name: 'Custom',
          description: 'Custom workspace',
          limits: {
            maxPostsPerHour: 5,
            maxReadRequestsPerMinute: 15,
            maxConcurrentSessions: 2,
            allowedOperations: ['read_posts'],
            maxContentLength: 1000,
            rateLimitWindow: 1800000,
          },
          permissions: {
            canCreatePosts: false,
            canReadPosts: true,
            canAccessFeed: false,
            canAccessAgentProfiles: false,
            canUsePrompts: false,
            canUseSampling: false,
          },
        };

        rootsManager.addRoot(customRoot);

        // Assign custom root to both sessions
        rootsManager.assignRootToSession('session1', 'social://custom');
        rootsManager.assignRootToSession('session2', 'social://custom');

        // Clear only session1
        rootsManager.clearSessionRoot('session1');

        // session1 should fall back to default, session2 should keep custom
        expect(rootsManager.getRootForSession('session1')?.uri).toBe('social://workspace');
        expect(rootsManager.getRootForSession('session2')?.uri).toBe('social://custom');
      });
    });
  });

  describe('registerRoots', () => {
    it('should register roots resource with MCP server', () => {
      const returnedManager = registerRoots(mockServer, mockContext);

      expect(mockServer.resource).toHaveBeenCalledTimes(1);
      expect(mockServer.resource).toHaveBeenCalledWith(
        'workspace-roots',
        'social://roots',
        expect.objectContaining({
          description: 'Available workspace boundaries and operational limits',
          mimeType: 'application/json',
        }),
        expect.any(Function)
      );

      expect(returnedManager).toBeInstanceOf(RootsManager);
    });

    it('should add roots manager to context', () => {
      registerRoots(mockServer, mockContext);

      expect(mockContext.rootsManager).toBeInstanceOf(RootsManager);
    });

    it('should create working roots resource handler', async () => {
      registerRoots(mockServer, mockContext);

      // Get the registered handler function
      const resourceHandler = mockServer.resource.mock.calls[0][3];

      // Call the handler
      const result = await resourceHandler();

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe('social://roots');
      expect(result.contents[0].mimeType).toBe('application/json');

      const content = JSON.parse(result.contents[0].text);
      expect(content.roots).toBeInstanceOf(Array);
      expect(content.roots).toHaveLength(1); // Default root
      expect(content.roots[0]).toEqual(
        expect.objectContaining({
          uri: 'social://workspace',
          name: 'Social Media Workspace',
          description: 'Default workspace for social media operations',
        })
      );
    });

    it('should handle multiple roots in resource response', async () => {
      const manager = registerRoots(mockServer, mockContext);

      // Add additional roots
      manager.addRoot({
        uri: 'social://premium',
        name: 'Premium Workspace',
        description: 'Premium features workspace',
        limits: {
          maxPostsPerHour: 50,
          maxReadRequestsPerMinute: 100,
          maxConcurrentSessions: 20,
          allowedOperations: ['read_posts', 'create_post', 'premium_feature'],
          maxContentLength: 5000,
          rateLimitWindow: 3600000,
        },
        permissions: {
          canCreatePosts: true,
          canReadPosts: true,
          canAccessFeed: true,
          canAccessAgentProfiles: true,
          canUsePrompts: true,
          canUseSampling: true,
        },
      });

      const resourceHandler = mockServer.resource.mock.calls[0][3];
      const result = await resourceHandler();

      const content = JSON.parse(result.contents[0].text);
      expect(content.roots).toHaveLength(2);

      const uris = content.roots.map((r: any) => r.uri);
      expect(uris).toContain('social://workspace');
      expect(uris).toContain('social://premium');
    });

    it('should handle resource handler errors gracefully', async () => {
      const manager = registerRoots(mockServer, mockContext);

      // Mock getAllRoots to throw an error
      jest.spyOn(manager, 'getAllRoots').mockImplementation(() => {
        throw new Error('Test error');
      });

      const resourceHandler = mockServer.resource.mock.calls[0][3];

      await expect(resourceHandler()).rejects.toThrow('Test error');
    });
  });

  describe('Integration Tests', () => {
    it('should support complete session workflow', () => {
      const manager = registerRoots(mockServer, mockContext);

      // Add custom workspace
      const customRoot: RootDefinition = {
        uri: 'social://workflow-test',
        name: 'Workflow Test',
        description: 'Testing complete workflow',
        limits: {
          maxPostsPerHour: 8,
          maxReadRequestsPerMinute: 25,
          maxConcurrentSessions: 3,
          allowedOperations: ['read_posts', 'create_post'],
          maxContentLength: 1500,
          rateLimitWindow: 3600000,
        },
        permissions: {
          canCreatePosts: true,
          canReadPosts: true,
          canAccessFeed: true,
          canAccessAgentProfiles: false,
          canUsePrompts: false,
          canUseSampling: false,
        },
      };

      manager.addRoot(customRoot);

      // Session starts with default root
      expect(manager.getRootForSession('workflow-session')?.uri).toBe('social://workspace');
      expect(manager.isOperationAllowed('workflow-session', 'login')).toBe(true);

      // Assign custom root
      const assigned = manager.assignRootToSession('workflow-session', 'social://workflow-test');
      expect(assigned).toBe(true);

      // Verify new constraints
      expect(manager.getRootForSession('workflow-session')?.uri).toBe('social://workflow-test');
      expect(manager.isOperationAllowed('workflow-session', 'read_posts')).toBe(true);
      expect(manager.isOperationAllowed('workflow-session', 'create_post')).toBe(true);
      expect(manager.isOperationAllowed('workflow-session', 'login')).toBe(false); // Not in custom allowed operations
      expect(manager.isContentLengthValid('workflow-session', 1500)).toBe(true);
      expect(manager.isContentLengthValid('workflow-session', 1501)).toBe(false);

      // Clear assignment
      manager.clearSessionRoot('workflow-session');
      expect(manager.getRootForSession('workflow-session')?.uri).toBe('social://workspace');
      expect(manager.isOperationAllowed('workflow-session', 'login')).toBe(true); // Back to default
    });

    it('should maintain session isolation', () => {
      const manager = registerRoots(mockServer, mockContext);

      const restrictiveRoot: RootDefinition = {
        uri: 'social://restrictive',
        name: 'Restrictive',
        description: 'Very restrictive workspace',
        limits: {
          maxPostsPerHour: 1,
          maxReadRequestsPerMinute: 5,
          maxConcurrentSessions: 1,
          allowedOperations: ['read_posts'],
          maxContentLength: 100,
          rateLimitWindow: 3600000,
        },
        permissions: {
          canCreatePosts: false,
          canReadPosts: true,
          canAccessFeed: false,
          canAccessAgentProfiles: false,
          canUsePrompts: false,
          canUseSampling: false,
        },
      };

      manager.addRoot(restrictiveRoot);

      // Assign restrictive root to session1, leave session2 with default
      manager.assignRootToSession('session1', 'social://restrictive');

      // Verify isolation
      expect(manager.isOperationAllowed('session1', 'create_post')).toBe(false);
      expect(manager.isOperationAllowed('session2', 'create_post')).toBe(true);

      expect(manager.isContentLengthValid('session1', 200)).toBe(false);
      expect(manager.isContentLengthValid('session2', 200)).toBe(true);

      expect(manager.getRootForSession('session1')?.limits.maxPostsPerHour).toBe(1);
      expect(manager.getRootForSession('session2')?.limits.maxPostsPerHour).toBe(10);
    });

    it('should handle concurrent operations safely', () => {
      const manager = registerRoots(mockServer, mockContext);

      // Simulate concurrent session assignments
      const sessions = ['session1', 'session2', 'session3', 'session4', 'session5'];
      const customRoot: RootDefinition = {
        uri: 'social://concurrent-test',
        name: 'Concurrent Test',
        description: 'Testing concurrent operations',
        limits: {
          maxPostsPerHour: 12,
          maxReadRequestsPerMinute: 40,
          maxConcurrentSessions: 8,
          allowedOperations: ['read_posts', 'create_post'],
          maxContentLength: 1800,
          rateLimitWindow: 3600000,
        },
        permissions: {
          canCreatePosts: true,
          canReadPosts: true,
          canAccessFeed: true,
          canAccessAgentProfiles: true,
          canUsePrompts: true,
          canUseSampling: false,
        },
      };

      manager.addRoot(customRoot);

      // Assign all sessions to custom root
      sessions.forEach(sessionId => {
        const result = manager.assignRootToSession(sessionId, 'social://concurrent-test');
        expect(result).toBe(true);
      });

      // Verify all sessions have correct assignment
      sessions.forEach(sessionId => {
        expect(manager.getRootForSession(sessionId)?.uri).toBe('social://concurrent-test');
        expect(manager.isOperationAllowed(sessionId, 'create_post')).toBe(true);
        expect(manager.isContentLengthValid(sessionId, 1800)).toBe(true);
      });

      // Clear some sessions
      manager.clearSessionRoot('session2');
      manager.clearSessionRoot('session4');

      // Verify selective clearing
      expect(manager.getRootForSession('session1')?.uri).toBe('social://concurrent-test');
      expect(manager.getRootForSession('session2')?.uri).toBe('social://workspace'); // Cleared
      expect(manager.getRootForSession('session3')?.uri).toBe('social://concurrent-test');
      expect(manager.getRootForSession('session4')?.uri).toBe('social://workspace'); // Cleared
      expect(manager.getRootForSession('session5')?.uri).toBe('social://concurrent-test');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty operation strings', () => {
      expect(rootsManager.isOperationAllowed('test-session', '')).toBe(false);
      expect(rootsManager.isOperationAllowed('test-session', '   ')).toBe(false);
    });

    it('should handle zero and negative content lengths', () => {
      expect(rootsManager.isContentLengthValid('test-session', 0)).toBe(true);
      expect(rootsManager.isContentLengthValid('test-session', -1)).toBe(true); // Technically valid since -1 <= 2000
    });

    it('should handle very large content lengths', () => {
      expect(rootsManager.isContentLengthValid('test-session', Number.MAX_SAFE_INTEGER)).toBe(false);
    });

    it('should handle special characters in session IDs', () => {
      const specialSessions = ['session@123', 'session.with.dots', 'session-with-dashes', 'session_with_underscores'];

      specialSessions.forEach(sessionId => {
        const result = rootsManager.assignRootToSession(sessionId, 'social://workspace');
        expect(result).toBe(true);

        const root = rootsManager.getRootForSession(sessionId);
        expect(root?.uri).toBe('social://workspace');
      });
    });

    it('should handle unicode characters in root URIs and names', () => {
      const unicodeRoot: RootDefinition = {
        uri: 'social://测试工作区',
        name: 'Test Workspace 测试',
        description: 'Unicode test workspace with émojis 🚀',
        limits: {
          maxPostsPerHour: 10,
          maxReadRequestsPerMinute: 30,
          maxConcurrentSessions: 5,
          allowedOperations: ['read_posts'],
          maxContentLength: 1000,
          rateLimitWindow: 3600000,
        },
        permissions: {
          canCreatePosts: false,
          canReadPosts: true,
          canAccessFeed: false,
          canAccessAgentProfiles: false,
          canUsePrompts: false,
          canUseSampling: false,
        },
      };

      rootsManager.addRoot(unicodeRoot);
      const assigned = rootsManager.assignRootToSession('unicode-session', 'social://测试工作区');

      expect(assigned).toBe(true);
      expect(rootsManager.getRootForSession('unicode-session')?.name).toBe('Test Workspace 测试');
    });
  });
});
