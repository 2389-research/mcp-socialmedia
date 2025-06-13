// ABOUTME: Enhanced middleware for protocol-level validation, error handling, and timeouts
// ABOUTME: Provides comprehensive request/response processing and error management

import { logger } from '../logger.js';
import { ErrorHandler } from './error-handler.js';
import { TimeoutManager } from './timeout.js';
import { RequestValidator } from './validator.js';

export interface MiddlewareContext {
  sessionId: string;
  startTime: number;
  requestId: string;
  method: string;
}

export class ProtocolMiddleware {
  private validator: RequestValidator;
  private errorHandler: ErrorHandler;
  private timeoutManager: TimeoutManager;

  constructor() {
    this.validator = new RequestValidator();
    this.errorHandler = new ErrorHandler();
    this.timeoutManager = new TimeoutManager();

    logger.info('Protocol middleware initialized');
  }

  /**
   * Process request through validation and preprocessing
   */
  async processRequest(request: any, context: MiddlewareContext): Promise<any> {
    const startTime = Date.now();

    try {
      // 1. Validate request structure
      await this.validator.validateRequest(request);

      // 2. Set up timeout
      const timeoutPromise = this.timeoutManager.createTimeout(context.method);

      // 3. Process with timeout
      const processedRequest = await Promise.race([
        this.doProcessRequest(request, context),
        timeoutPromise,
      ]);

      logger.debug('Request processed successfully', {
        method: context.method,
        sessionId: context.sessionId,
        processingTime: Date.now() - startTime,
      });

      return processedRequest;
    } catch (error) {
      const processedError = await this.errorHandler.handleError(error, request, context);
      throw processedError;
    }
  }

  /**
   * Process response through enrichment and validation
   */
  async processResponse(response: any, request: any, context: MiddlewareContext): Promise<any> {
    try {
      // Validate response structure
      await this.validator.validateResponse(response, request.method);

      // Add processing metadata
      const enrichedResponse = {
        ...response,
        _processingTime: Date.now() - context.startTime,
        _requestId: context.requestId,
      };

      return enrichedResponse;
    } catch (error) {
      const processedError = await this.errorHandler.handleError(error, request, context);
      throw processedError;
    }
  }

  private async doProcessRequest(request: any, context: MiddlewareContext): Promise<any> {
    // Add request metadata
    const enrichedRequest = {
      ...request,
      _metadata: {
        requestId: context.requestId,
        sessionId: context.sessionId,
        timestamp: new Date().toISOString(),
        processingStarted: context.startTime,
      },
    };

    return enrichedRequest;
  }

  /**
   * Get middleware statistics
   */
  getStats() {
    return {
      validator: this.validator.getStats(),
      errorHandler: this.errorHandler.getStats(),
      timeoutManager: this.timeoutManager.getStats(),
    };
  }
}

export { RequestValidator } from './validator.js';
export { ErrorHandler } from './error-handler.js';
export { TimeoutManager } from './timeout.js';
