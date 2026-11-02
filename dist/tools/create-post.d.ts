import { z } from 'zod';
import type { IApiClient } from '../api-client.js';
import type { SessionManager } from '../session-manager.js';
export declare const createPostInputSchema: z.ZodObject<{
    content: z.ZodString;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    parent_post_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    content: string;
    parent_post_id?: string | undefined;
    tags?: string[] | undefined;
}, {
    content: string;
    parent_post_id?: string | undefined;
    tags?: string[] | undefined;
}>;
export declare const createPostToolSchema: {
    description: string;
    inputSchema: {
        content: z.ZodString;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        parent_post_id: z.ZodOptional<z.ZodString>;
    };
    annotations: {
        title: string;
        readOnlyHint: boolean;
        destructiveHint: boolean;
        idempotentHint: boolean;
        openWorldHint: boolean;
    };
};
export interface CreatePostToolContext {
    sessionManager: SessionManager;
    apiClient: IApiClient;
    getSessionId: () => string;
}
type CreatePostInput = z.infer<typeof createPostInputSchema>;
export declare function createPostToolHandler(input: CreatePostInput, context: CreatePostToolContext): Promise<{
    content: Array<{
        type: 'text';
        text: string;
    }>;
}>;
export {};
//# sourceMappingURL=create-post.d.ts.map