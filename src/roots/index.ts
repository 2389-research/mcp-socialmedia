// ABOUTME: MCP Roots implementation for workspace boundaries and operational limits
// ABOUTME: Defines and enforces multi-tenant configuration and access controls

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../logger.js';
import { RootDefinition, RootLimits } from './types.js';

interface RootsContext {
  apiClient: any;
  sessionManager: any;
  hooksManager?: any;
}

export class RootsManager {
  private roots: Map<string, RootDefinition> = new Map();
  private sessionRootMap: Map<string, string> = new Map();

  constructor() {
    // Define default root for social media workspace
    const defaultRoot: RootDefinition = {
      uri: 'social://workspace',
      name: 'Social Media Workspace',
      description: 'Default workspace for social media operations',
      limits: {
        maxPostsPerHour: 10,
        maxReadRequestsPerMinute: 30,
        maxConcurrentSessions: 5,
        allowedOperations: ['read_posts', 'create_post', 'login'],
        maxContentLength: 2000,
        rateLimitWindow: 3600000, // 1 hour in ms
      },
      permissions: {
        canCreatePosts: true,
        canReadPosts: true,
        canAccessFeed: true,
        canAccessAgentProfiles: true,
        canUsePrompts: true,
        canUseSampling: true,
      }
    };

    this.roots.set(defaultRoot.uri, defaultRoot);
    logger.info('Roots manager initialized', { rootCount: this.roots.size });
  }

  /**
   * Get root definition for a session
   */
  getRootForSession(sessionId: string): RootDefinition | undefined {
    const rootUri = this.sessionRootMap.get(sessionId) || 'social://workspace';
    return this.roots.get(rootUri);
  }

  /**
   * Assign a root to a session
   */
  assignRootToSession(sessionId: string, rootUri: string): boolean {
    if (!this.roots.has(rootUri)) {
      logger.warn('Attempted to assign non-existent root', { sessionId, rootUri });
      return false;
    }

    this.sessionRootMap.set(sessionId, rootUri);
    logger.debug('Assigned root to session', { sessionId, rootUri });
    return true;
  }

  /**
   * Check if an operation is allowed for a session
   */
  isOperationAllowed(sessionId: string, operation: string): boolean {
    const root = this.getRootForSession(sessionId);
    if (!root) {
      return false;
    }

    return root.limits.allowedOperations.includes(operation);
  }

  /**
   * Check if content length is within limits
   */
  isContentLengthValid(sessionId: string, contentLength: number): boolean {
    const root = this.getRootForSession(sessionId);
    if (!root) {
      return false;
    }

    return contentLength <= root.limits.maxContentLength;
  }

  /**
   * Get all available roots
   */
  getAllRoots(): RootDefinition[] {
    return Array.from(this.roots.values());
  }

  /**
   * Add a new root definition
   */
  addRoot(root: RootDefinition): void {
    this.roots.set(root.uri, root);
    logger.info('Added new root', { uri: root.uri, name: root.name });
  }

  /**
   * Remove a session's root assignment
   */
  clearSessionRoot(sessionId: string): void {
    this.sessionRootMap.delete(sessionId);
    logger.debug('Cleared session root assignment', { sessionId });
  }
}

export function registerRoots(server: McpServer, context: RootsContext) {
  const rootsManager = new RootsManager();

  // Add the roots manager to the context for other modules to use
  (context as any).rootsManager = rootsManager;

  // Register roots as a resource
  server.resource(
    'workspace-roots',
    'social://roots',
    {
      description: 'Available workspace boundaries and operational limits',
      mimeType: 'application/json',
    },
    async () => {
      try {
        logger.debug('Processing roots resource request');

        const roots = rootsManager.getAllRoots();

        return {
          contents: [
            {
              uri: 'social://roots',
              text: JSON.stringify({
                roots: roots.map(root => ({
                  uri: root.uri,
                  name: root.name,
                  description: root.description
                }))
              }, null, 2),
              mimeType: 'application/json'
            }
          ]
        };
      } catch (error) {
        logger.error('Error in roots resource', {
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    }
  );

  logger.info('Roots resource registered');
  return rootsManager;
}
