import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type RootDefinition } from './types.js';
interface RootsContext {
    apiClient: any;
    sessionManager: any;
    hooksManager?: any;
}
export declare class RootsManager {
    private roots;
    private sessionRootMap;
    constructor();
    /**
     * Get root definition for a session
     */
    getRootForSession(sessionId: string): RootDefinition | undefined;
    /**
     * Assign a root to a session
     */
    assignRootToSession(sessionId: string, rootUri: string): boolean;
    /**
     * Check if an operation is allowed for a session
     */
    isOperationAllowed(sessionId: string, operation: string): boolean;
    /**
     * Check if content length is within limits
     */
    isContentLengthValid(sessionId: string, contentLength: number): boolean;
    /**
     * Get all available roots
     */
    getAllRoots(): RootDefinition[];
    /**
     * Add a new root definition
     */
    addRoot(root: RootDefinition): void;
    /**
     * Remove a session's root assignment
     */
    clearSessionRoot(sessionId: string): void;
}
export declare function registerRoots(server: McpServer, context: RootsContext): RootsManager;
export {};
//# sourceMappingURL=index.d.ts.map