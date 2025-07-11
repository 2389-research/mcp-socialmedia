// ABOUTME: Enhanced logging utility for the MCP Agent Social Media Server
// ABOUTME: Provides structured logging with levels, context, and performance tracking

import { ENV_KEYS } from './config.js';

export enum LogLevel {
  SILENT = -1,
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogContext {
  tool?: string;
  sessionId?: string;
  agentName?: string;
  requestId?: string;
  [key: string]: unknown;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private startTime: number;

  private constructor() {
    this.logLevel = this.parseLogLevel(process.env[ENV_KEYS.LOG_LEVEL] || 'INFO');
    this.startTime = Date.now();
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toUpperCase()) {
      case 'SILENT':
        return LogLevel.SILENT;
      case 'ERROR':
        return LogLevel.ERROR;
      case 'WARN':
        return LogLevel.WARN;
      case 'INFO':
        return LogLevel.INFO;
      case 'DEBUG':
        return LogLevel.DEBUG;
      default:
        return LogLevel.INFO;
    }
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    let contextStr = '';

    if (context) {
      try {
        contextStr = ` ${JSON.stringify(context)}`;
      } catch (error) {
        // Handle circular references or other JSON serialization errors
        contextStr = ` ${JSON.stringify(
          {
            ...context,
            _jsonError: error instanceof Error ? error.message : 'Unknown JSON error',
          },
          (key, value) => {
            if (typeof value === 'object' && value !== null) {
              // Simple circular reference detection
              if (
                typeof value.toString === 'function' &&
                value.toString().includes('[object Object]')
              ) {
                return '[Object]';
              }
            }
            return value;
          },
        )}`;
      }
    }

    return `[${timestamp}] [${level}] [uptime:${uptime}s] ${message}${contextStr}`;
  }

  private log(level: LogLevel, levelStr: string, message: string, context?: LogContext): void {
    if (level <= this.logLevel) {
      const formattedMessage = this.formatMessage(levelStr, message, context);
      try {
        if (level === LogLevel.ERROR) {
          console.error(formattedMessage);
        } else {
          console.log(formattedMessage);
        }
      } catch (error) {
        // Ignore EPIPE errors - they happen when stdout is closed (e.g., when Claude Desktop disconnects)
        if (error instanceof Error && 'code' in error && error.code !== 'EPIPE') {
          // Only rethrow non-EPIPE errors
          throw error;
        }
      }
    }
  }

  error(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, 'ERROR', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, 'WARN', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, 'INFO', message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, context);
  }

  // Tool-specific logging helpers
  toolStart(toolName: string, args: unknown, context?: LogContext): void {
    this.info(`Tool ${toolName} started`, {
      tool: toolName,
      args: args,
      ...context,
    });
  }

  toolSuccess(toolName: string, duration: number, context?: LogContext): void {
    this.info(`Tool ${toolName} completed`, {
      tool: toolName,
      duration: `${duration}ms`,
      status: 'success',
      ...context,
    });
  }

  toolError(toolName: string, error: Error, duration: number, context?: LogContext): void {
    this.error(`Tool ${toolName} failed`, {
      tool: toolName,
      duration: `${duration}ms`,
      status: 'error',
      error: error.message,
      stack: error.stack,
      ...context,
    });
  }

  // Session-specific logging
  sessionCreated(sessionId: string, agentName: string): void {
    this.info('Session created', { sessionId, agentName, event: 'session_created' });
  }

  sessionDeleted(sessionId: string, agentName?: string): void {
    this.info('Session deleted', { sessionId, agentName, event: 'session_deleted' });
  }

  sessionValidationFailed(sessionId: string, reason: string): void {
    this.warn('Session validation failed', {
      sessionId,
      reason,
      event: 'session_validation_failed',
    });
  }

  // API-specific logging
  apiRequest(method: string, url: string, context?: LogContext): void {
    this.debug(`API request: ${method} ${url}`, {
      method,
      url,
      event: 'api_request',
      ...context,
    });
  }

  apiResponse(
    method: string,
    url: string,
    status: number,
    duration: number,
    context?: LogContext,
  ): void {
    const logMethod = status >= 400 ? this.warn.bind(this) : this.debug.bind(this);

    logMethod(`API response: ${method} ${url} - ${status}`, {
      method,
      url,
      status,
      duration: `${duration}ms`,
      event: 'api_response',
      ...context,
    });
  }

  apiError(method: string, url: string, error: Error, context?: LogContext): void {
    this.error(`API error: ${method} ${url}`, {
      method,
      url,
      error: error.message,
      event: 'api_error',
      ...context,
    });
  }

  // Performance logging
  performance(operation: string, duration: number, context?: LogContext): void {
    const logMethod = duration > 1000 ? this.warn.bind(this) : this.info.bind(this);

    logMethod(`Performance: ${operation}`, {
      operation,
      duration: `${duration}ms`,
      slow: duration > 1000,
      ...context,
    });
  }
}

// Export singleton instance
export const logger = Logger.getInstance();
