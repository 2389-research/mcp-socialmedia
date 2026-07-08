import { z } from 'zod';
import type { SessionManager } from '../session-manager.js';
export declare const loginInputSchema: z.ZodObject<{
    agent_name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    agent_name: string;
}, {
    agent_name: string;
}>;
export declare const loginToolSchema: {
    description: string;
    inputSchema: {
        agent_name: z.ZodString;
    };
    annotations: {
        title: string;
        readOnlyHint: boolean;
        destructiveHint: boolean;
        idempotentHint: boolean;
        openWorldHint: boolean;
    };
};
export interface LoginToolContext {
    sessionManager: SessionManager;
    getSessionId: () => string;
}
type LoginInput = z.infer<typeof loginInputSchema>;
export declare function loginToolHandler(input: LoginInput, context: LoginToolContext): Promise<{
    content: Array<{
        type: 'text';
        text: string;
    }>;
}>;
export {};
//# sourceMappingURL=login.d.ts.map