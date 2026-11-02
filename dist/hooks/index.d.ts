import { type Hook, type HookContext } from './types.js';
export declare class HooksManager {
    private requestHooks;
    private responseHooks;
    private errorHooks;
    private rateLimitWindows;
    constructor();
    /**
     * Register a hook
     */
    registerHook(hook: Hook): void;
    /**
     * Process request through all request hooks
     */
    processRequest(request: any, context: HookContext): Promise<any>;
    /**
     * Process response through all response hooks
     */
    processResponse(response: any, request: any, context: HookContext): Promise<any>;
    /**
     * Process error through all error hooks
     */
    processError(error: Error, request: any, context: HookContext): Promise<Error>;
    /**
     * Register default hooks
     */
    private registerDefaultHooks;
    /**
     * Get all registered hooks
     */
    getAllHooks(): Hook[];
    /**
     * Remove a hook by name
     */
    removeHook(name: string): boolean;
}
export declare const hooksManager: HooksManager;
//# sourceMappingURL=index.d.ts.map