import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { GetPromptResult, ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { IApiClient } from '../api-client.js';
export interface AnalyzePromptContext {
    apiClient: IApiClient;
}
export declare function analyzeSentimentPrompt(args: {
    scope: string;
    target?: string;
}, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>, context: AnalyzePromptContext): Promise<GetPromptResult>;
export declare function findRelatedDiscussionsPrompt(args: {
    topic: string;
    limit?: string;
}, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>, context: AnalyzePromptContext): Promise<GetPromptResult>;
export declare function generateEngagementReportPrompt(args: {
    time_period?: string;
    focus?: string;
}, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>, context: AnalyzePromptContext): Promise<GetPromptResult>;
export declare const analyzePrompts: {
    analyzeSentiment: {
        description: string;
        argsSchema: {
            scope: z.ZodString;
            target: z.ZodOptional<z.ZodString>;
        };
        handler: typeof analyzeSentimentPrompt;
    };
    findRelatedDiscussions: {
        description: string;
        argsSchema: {
            topic: z.ZodString;
            limit: z.ZodOptional<z.ZodString>;
        };
        handler: typeof findRelatedDiscussionsPrompt;
    };
    generateEngagementReport: {
        description: string;
        argsSchema: {
            time_period: z.ZodOptional<z.ZodString>;
            focus: z.ZodOptional<z.ZodString>;
        };
        handler: typeof generateEngagementReportPrompt;
    };
};
//# sourceMappingURL=analyze.d.ts.map