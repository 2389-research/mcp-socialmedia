// ABOUTME: Tests for configuration management
// ABOUTME: Validates environment variable loading and config validation

import { jest } from '@jest/globals';
import { validateConfig, getConfig } from '../src/config';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('validateConfig', () => {
    it('should validate a complete configuration', () => {
      process.env.SOCIALMEDIA_API_BASE_URL = 'https://api.example.com';
      process.env.SOCIALMEDIA_API_KEY = 'test-key';
      process.env.SOCIALMEDIA_TEAM_ID = 'test-team';
      process.env.PORT = '3000';

      expect(() => validateConfig()).not.toThrow();
    });

    it('should throw error for missing SOCIALMEDIA_API_BASE_URL', () => {
      delete process.env.SOCIALMEDIA_API_BASE_URL;
      process.env.SOCIALMEDIA_API_KEY = 'test-key';
      process.env.SOCIALMEDIA_TEAM_ID = 'test-team';

      expect(() => validateConfig()).toThrow(/SOCIALMEDIA_API_BASE_URL/);
    });

    it('should throw error for missing SOCIALMEDIA_API_KEY', () => {
      process.env.SOCIALMEDIA_API_BASE_URL = 'https://api.example.com';
      delete process.env.SOCIALMEDIA_API_KEY;
      process.env.SOCIALMEDIA_TEAM_ID = 'test-team';

      expect(() => validateConfig()).toThrow(/SOCIALMEDIA_API_KEY/);
    });

    it('should throw error for missing SOCIALMEDIA_TEAM_ID', () => {
      process.env.SOCIALMEDIA_API_BASE_URL = 'https://api.example.com';
      process.env.SOCIALMEDIA_API_KEY = 'test-key';
      delete process.env.SOCIALMEDIA_TEAM_ID;

      expect(() => validateConfig()).toThrow(/SOCIALMEDIA_TEAM_ID/);
    });

    it('should throw error for invalid PORT', () => {
      process.env.SOCIALMEDIA_API_BASE_URL = 'https://api.example.com';
      process.env.SOCIALMEDIA_API_KEY = 'test-key';
      process.env.SOCIALMEDIA_TEAM_ID = 'test-team';
      process.env.PORT = '70000';

      expect(() => validateConfig()).toThrow('PORT must be a valid port number');
    });

    it('should use default PORT if not specified', () => {
      process.env.SOCIALMEDIA_API_BASE_URL = 'https://api.example.com';
      process.env.SOCIALMEDIA_API_KEY = 'test-key';
      process.env.SOCIALMEDIA_TEAM_ID = 'test-team';
      delete process.env.PORT;

      const config = getConfig();
      expect(config.port).toBe(3000);
    });

    it('should use default LOG_LEVEL if not specified', () => {
      process.env.SOCIALMEDIA_API_BASE_URL = 'https://api.example.com';
      process.env.SOCIALMEDIA_API_KEY = 'test-key';
      process.env.SOCIALMEDIA_TEAM_ID = 'test-team';
      delete process.env.LOG_LEVEL;

      const config = getConfig();
      expect(config.logLevel).toBe('info');
    });
  });
});
