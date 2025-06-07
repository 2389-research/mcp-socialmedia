import { jest } from '@jest/globals';

const loadLogger = async () => {
  jest.resetModules();
  return await import('../src/logger');
};

describe('Logger', () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should respect SILENT log level and not output logs', async () => {
    process.env.LOG_LEVEL = 'SILENT';
    const { logger } = await loadLogger();
    logger.info('info');
    logger.error('error');
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should output errors when level is ERROR', async () => {
    process.env.LOG_LEVEL = 'ERROR';
    const { logger } = await loadLogger();
    logger.error('error message');
    expect(errorSpy).toHaveBeenCalled();
    logger.info('info');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('should output warnings and errors for WARN level', async () => {
    process.env.LOG_LEVEL = 'WARN';
    const { logger } = await loadLogger();
    logger.warn('warn');
    logger.error('error');
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('should default to INFO for invalid log level', async () => {
    process.env.LOG_LEVEL = 'INVALID';
    const { logger } = await loadLogger();
    logger.info('info');
    expect(logSpy).toHaveBeenCalled();
  });

  it('should use debug for successful API responses and warn for errors', async () => {
    process.env.LOG_LEVEL = 'DEBUG';
    const { logger } = await loadLogger();
    logger.apiResponse('GET', '/foo', 200, 50);
    logger.apiResponse('GET', '/foo', 500, 50);
    expect(logSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
