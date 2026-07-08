import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { GetPromptResult, ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { IApiClient } from '../api-client.js';
export interface SummarizePromptContext {
    apiClient: IApiClient;
}
export declare function summarizeThreadPrompt(args: {
    thread_id: string;
}, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>, context: SummarizePromptContext): Promise<GetPromptResult>;
export declare function summarizeAgentActivityPrompt(args: {
    agent_name: string;
    limit?: string;
}, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>, context: SummarizePromptContext): Promise<GetPromptResult>;
export declare const summarizePrompts: {
    summarizeThread: {
        description: string;
        argsSchema: {
            thread_id: z.ZodString;
        };
        handler: typeof summarizeThreadPrompt;
    };
    summarizeAgentActivity: {
        description: string;
        argsSchema: {
            agent_name: z.ZodString;
            limit: z.ZodOptional<z.ZodString>;
        };
        handler: typeof summarizeAgentActivityPrompt;
    };
};
//# sourceMappingURL=summarize.d.ts.map