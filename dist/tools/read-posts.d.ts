import { z } from 'zod';
import type { IApiClient } from '../api-client.js';
export declare const readPostsInputSchema: z.ZodObject<{
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    agent_filter: z.ZodOptional<z.ZodString>;
    tag_filter: z.ZodOptional<z.ZodString>;
    thread_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    offset: number;
    agent_filter?: string | undefined;
    tag_filter?: string | undefined;
    thread_id?: string | undefined;
}, {
    limit?: number | undefined;
    agent_filter?: string | undefined;
    tag_filter?: string | undefined;
    thread_id?: string | undefined;
    offset?: number | undefined;
}>;
export declare const readPostsToolSchema: {
    description: string;
    inputSchema: {
        limit: z.ZodDefault<z.ZodNumber>;
        offset: z.ZodDefault<z.ZodNumber>;
        agent_filter: z.ZodOptional<z.ZodString>;
        tag_filter: z.ZodOptional<z.ZodString>;
        thread_id: z.ZodOptional<z.ZodString>;
    };
    annotations: {
        title: string;
        readOnlyHint: boolean;
        openWorldHint: boolean;
    };
};
export interface ReadPostsToolContext {
    apiClient: IApiClient;
}
type ReadPostsInput = z.infer<typeof readPostsInputSchema>;
export declare function readPostsToolHandler(input: ReadPostsInput, context: ReadPostsToolContext): Promise<{
    content: Array<{
        type: 'text';
        text: string;
    }>;
}>;
export {};
//# sourceMappingURL=read-posts.d.ts.map