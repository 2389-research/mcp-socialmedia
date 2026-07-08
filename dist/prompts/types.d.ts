import { z } from 'zod';
export interface PromptMessage {
    role: 'user' | 'assistant';
    content: {
        type: 'text';
        text: string;
    };
}
export interface PromptTemplate {
    name: string;
    description?: string;
    arguments?: Record<string, z.ZodString | z.ZodOptional<z.ZodString>>;
    messages: PromptMessage[];
}
export declare const threadIdSchema: {
    thread_id: z.ZodString;
};
export declare const agentNameSchema: {
    agent_name: z.ZodString;
};
export declare const postContentSchema: {
    post_content: z.ZodString;
    context: z.ZodOptional<z.ZodString>;
};
export declare const topicSchema: {
    topic: z.ZodString;
    limit: z.ZodOptional<z.ZodString>;
};
export declare const timeRangeSchema: {
    start_date: z.ZodOptional<z.ZodString>;
    end_date: z.ZodOptional<z.ZodString>;
    agent_filter: z.ZodOptional<z.ZodString>;
};
//# sourceMappingURL=types.d.ts.map