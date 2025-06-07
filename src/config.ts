// ABOUTME: Configuration management for the MCP server
// ABOUTME: Loads and validates environment variables

import { config as loadDotenv } from 'dotenv';
import type { ServerConfig } from './types.js';

loadDotenv();

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && !defaultValue) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || defaultValue!;
}

export function getConfig(): ServerConfig {
  return {
    socialApiBaseUrl: getEnvVar('SOCIALMEDIA_API_BASE_URL'),
    socialApiKey: getEnvVar('SOCIALMEDIA_API_KEY'),
    teamName: getEnvVar('SOCIALMEDIA_TEAM_ID'),
    port: Number.parseInt(getEnvVar('PORT', '3000'), 10),
    logLevel: getEnvVar('LOG_LEVEL', 'info'),
    apiTimeout: Number.parseInt(getEnvVar('API_TIMEOUT', '30000'), 10), // 30 seconds default
  };
}

export const config: ServerConfig = getConfig();

export function validateConfig(): void {
  const errors: string[] = [];

  try {
    const conf = getConfig();

    if (!conf.socialApiBaseUrl) {
      errors.push('SOCIALMEDIA_API_BASE_URL is required');
    }

    if (!conf.socialApiKey) {
      errors.push('SOCIALMEDIA_API_KEY is required');
    }

    if (!conf.teamName) {
      errors.push('SOCIALMEDIA_TEAM_ID is required');
    }

    if (Number.isNaN(conf.port) || conf.port < 1 || conf.port > 65535) {
      errors.push('PORT must be a valid port number (1-65535)');
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}
