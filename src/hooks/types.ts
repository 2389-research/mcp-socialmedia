// ABOUTME: Type definitions for MCP Request/Response Hooks
// ABOUTME: Defines hook interfaces, context, and pipeline structures

export type HookType = 'request' | 'response' | 'error';

export interface HookContext {
  sessionId: string;
  startTime: number;
  metadata?: Record<string, any>;
}

export interface BaseHook {
  name: string;
  type: HookType;
  priority: number; // Lower numbers execute first
  description?: string;
  critical?: boolean; // If true, hook failures will fail the entire request
}

export interface RequestHook extends BaseHook {
  type: 'request';
  condition?: (request: any, context: HookContext) => boolean;
  execute: (request: any, context: HookContext) => Promise<any | undefined>;
}

export interface ResponseHook extends BaseHook {
  type: 'response';
  condition?: (response: any, request: any, context: HookContext) => boolean;
  execute: (response: any, request: any, context: HookContext) => Promise<any | undefined>;
}

export interface ErrorHook extends BaseHook {
  type: 'error';
  condition?: (error: Error, request: any, context: HookContext) => boolean;
  execute: (error: Error, request: any, context: HookContext) => Promise<Error | undefined>;
}

export type Hook = RequestHook | ResponseHook | ErrorHook;

export interface HookPipeline {
  processRequest(request: any, context: HookContext): Promise<any>;
  processResponse(response: any, request: any, context: HookContext): Promise<any>;
  processError(error: Error, request: any, context: HookContext): Promise<Error>;
}
