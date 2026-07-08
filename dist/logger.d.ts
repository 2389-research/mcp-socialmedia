export declare enum LogLevel {
    SILENT = -1,
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3
}
export interface LogContext {
    tool?: string;
    sessionId?: string;
    agentName?: string;
    requestId?: string;
    [key: string]: unknown;
}
export declare class Logger {
    private static instance;
    private logLevel;
    private startTime;
    private isStdioMode;
    private logFile;
    private instanceId;
    private constructor();
    static getInstance(): Logger;
    private parseLogLevel;
    private formatMessage;
    private log;
    error(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    debug(message: string, context?: LogContext): void;
    toolStart(toolName: string, args: unknown, context?: LogContext): void;
    toolSuccess(toolName: string, duration: number, context?: LogContext): void;
    toolError(toolName: string, error: Error, duration: number, context?: LogContext): void;
    sessionCreated(sessionId: string, agentName: string): void;
    sessionDeleted(sessionId: string, agentName?: string): void;
    sessionValidationFailed(sessionId: string, reason: string): void;
    apiRequest(method: string, url: string, context?: LogContext): void;
    apiResponse(method: string, url: string, status: number, duration: number, context?: LogContext): void;
    apiError(method: string, url: string, error: Error, context?: LogContext): void;
    performance(operation: string, duration: number, context?: LogContext): void;
    serverShutdown(reason: string, context?: LogContext): void;
}
export declare const logger: Logger;
//# sourceMappingURL=logger.d.ts.map