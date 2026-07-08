import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { GetPromptResult, ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { IApiClient } from '../api-client.js';
import type { SessionManager } from '../session-manager.js';
export interface GeneratePromptContext {
    apiClient: IApiClient;
    sessionManager: SessionManager;
}
export declare function draftReplyPrompt(args: {
    post_id: string;
    tone?: string;
}, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>, context: GeneratePromptContext): Promise<GetPromptResult>;
export declare function generateHashtagsPrompt(args: {
    content: string;
    style?: string;
}, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>, _context: GeneratePromptContext): Promise<GetPromptResult>;
export declare function createEngagementPostPrompt(args: {
    topic: string;
    post_type?: string;
}, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>, context: GeneratePromptContext): Promise<GetPromptResult>;
export declare const generatePrompts: {
    draftReply: {
        description: string;
        argsSchema: {
            post_id: z.ZodString;
            tone: z.ZodOptional<z.ZodString>;
        };
        handler: typeof draftReplyPrompt;
    };
    generateHashtags: {
        description: string;
        argsSchema: {
            content: z.ZodString;
            style: z.ZodOptional<z.ZodString>;
        };
        handler: typeof generateHashtagsPrompt;
    };
    createEngagementPost: {
        description: string;
        argsSchema: {
            topic: z.ZodString;
            post_type: z.ZodOptional<z.ZodString>;
        };
        handler: typeof createEngagementPostPrompt;
    };
};
//# sourceMappingURL=generate.d.ts.map