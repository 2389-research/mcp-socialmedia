// ABOUTME: Enhanced logging utility for the MCP Agent Social Media Server
// ABOUTME: Provides structured logging with levels, context, and performance tracking

import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
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
  private isStdioMode: boolean;
  private logFile: string | null;
  private instanceId: string;

  private constructor() {
    this.logLevel = this.parseLogLevel(process.env[ENV_KEYS.LOG_LEVEL] || 'INFO');
    this.startTime = Date.now();
    this.isStdioMode = process.env[ENV_KEYS.MCP_TRANSPORT] !== 'http';
    this.logFile = process.env.LOG_FILE || null;

    // Create instance identifier from current working directory + process ID
    const cwd = process.cwd();
    const cwdParts = cwd.split('/');
    const dirName = cwdParts[cwdParts.length - 1] || 'unknown';
    this.instanceId = `${dirName}:${process.pid}`;

    // Initialize log file if specified
    if (this.logFile) {
      try {
        // Ensure directory exists
        const logDir = dirname(this.logFile);
        if (!existsSync(logDir)) {
          mkdirSync(logDir, { recursive: true });
        }

        // Write startup banner to log file
        const banner = `\n=== MCP Agent Social Server [${this.instanceId}] Started at ${new Date().toISOString()} ===\n`;
        if (existsSync(this.logFile)) {
          appendFileSync(this.logFile, banner);
        } else {
          writeFileSync(this.logFile, banner);
        }
      } catch (error) {
        // If file logging fails, continue without it but log to stderr
        process.stderr.write(`Failed to initialize log file ${this.logFile}: ${error}\n`);
        this.logFile = null;
      }
    }
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
          (_key, value) => {
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

    return `[${timestamp}] [${level}] [${this.instanceId}] [uptime:${uptime}s] ${message}${contextStr}`;
  }

  private log(level: LogLevel, levelStr: string, message: string, context?: LogContext): void {
    if (level <= this.logLevel) {
      const formattedMessage = this.formatMessage(levelStr, message, context);

      // Always write to file if configured
      if (this.logFile) {
        try {
          appendFileSync(this.logFile, `${formattedMessage}\n`);
        } catch (error) {
          // If file logging fails, try stderr but don't create infinite loops
          try {
            process.stderr.write(`File logging failed: ${error}\n`);
          } catch (_stderrError) {
            // If both file and stderr fail, silently continue - avoid infinite loops
            // This prevents EPIPE cascades when stdio is completely broken
          }
        }
      }

      try {
        if (this.isStdioMode) {
          // In stdio mode, write to stderr to avoid polluting JSON-RPC stream
          process.stderr.write(`${formattedMessage}\n`);
        } else {
          // In HTTP mode, use console logging
          if (level === LogLevel.ERROR) {
            console.error(formattedMessage);
          } else {
            console.log(formattedMessage);
          }
        }
      } catch (error) {
        // Completely ignore EPIPE errors to prevent infinite loops
        // These happen when stdout/stderr are closed (e.g., when Claude Desktop disconnects)
        if (error instanceof Error && 'code' in error && error.code === 'EPIPE') {
          // Silent fail on EPIPE - don't try to log this error as it creates infinite loops
          return;
        }

        // Only rethrow non-EPIPE errors, but also protect against infinite loops
        if (this.logFile) {
          try {
            appendFileSync(this.logFile, `Logger stdio error: ${error}\n`);
          } catch (_fileError) {
            // If both stdio and file fail, we're in a bad state - just return
            return;
          }
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

  // Shutdown/death logging
  serverShutdown(reason: string, context?: LogContext): void {
    const shutdownMessage = `=== SERVER SHUTDOWN: ${reason} at ${new Date().toISOString()} ===`;

    // Always write shutdown to file if configured, even if log level is low
    if (this.logFile) {
      try {
        appendFileSync(this.logFile, `${shutdownMessage}\n`);
        if (context) {
          appendFileSync(this.logFile, `Context: ${JSON.stringify(context)}\n`);
        }
        appendFileSync(
          this.logFile,
          `Uptime: ${Math.floor((Date.now() - this.startTime) / 1000)}s\n\n`,
        );
      } catch (error) {
        // Even if file logging fails, try to write to stderr but avoid infinite loops
        try {
          process.stderr.write(`File logging failed during shutdown: ${error}\n`);
        } catch (_stderrError) {
          // If both fail during shutdown, we can't do much - just continue
        }
      }
    }

    // Also log normally
    this.error(`Server shutting down: ${reason}`, {
      reason,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
      ...context,
    });
  }
}

// Export singleton instance
export const logger = Logger.getInstance();
