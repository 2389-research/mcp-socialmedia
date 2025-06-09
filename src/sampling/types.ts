// ABOUTME: Type definitions for MCP Sampling functionality
// ABOUTME: Defines schemas and interfaces for sampling requests and responses

import { z } from 'zod';

// Message schema for sampling requests
export const MessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string()
});

export type Message = z.infer<typeof MessageSchema>;

// Sampling create request schema
export const SamplingCreateRequestSchema = z.object({
  model: z.string().optional(),
  messages: z.array(MessageSchema),
  maxTokens: z.number().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  includeContext: z.boolean().optional().default(false),
  template: z.string().optional()
});

export type SamplingCreateRequest = z.infer<typeof SamplingCreateRequestSchema>;

// Internal sampling request type
export interface SamplingRequest {
  model: string;
  messages: Message[];
  maxTokens: number;
  temperature: number;
  stream: boolean;
}

// Template processor interface
export interface TemplateProcessor {
  name: string;
  description: string;
  process(messages: Message[], context: any): Promise<Message[]>;
}

// Sampling response type
export interface SamplingResponse {
  role: 'assistant';
  content: {
    type: 'text';
    text: string;
  };
}
