// ABOUTME: Configuration management for the MCP server
// ABOUTME: Loads and validates environment variables

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import type { ServerConfig } from './types.js';

loadDotenv();

// Centralized configuration keys - single source of truth
export const ENV_KEYS = {
  SOCIALMEDIA_API_BASE_URL: 'SOCIALMEDIA_API_BASE_URL',
  SOCIALMEDIA_API_KEY: 'SOCIALMEDIA_API_KEY',
  SOCIALMEDIA_TEAM_ID: 'SOCIALMEDIA_TEAM_ID',
  PORT: 'PORT',
  LOG_LEVEL: 'LOG_LEVEL',
  API_TIMEOUT: 'API_TIMEOUT',
  MCP_TRANSPORT: 'MCP_TRANSPORT',
  MCP_HTTP_PORT: 'MCP_HTTP_PORT',
  MCP_HTTP_HOST: 'MCP_HTTP_HOST',
  MCP_ENABLE_JSON: 'MCP_ENABLE_JSON',
  MCP_CORS_ORIGIN: 'MCP_CORS_ORIGIN',
} as const;

// Get version from package.json
function getVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version;
  } catch (_error) {
    // Fallback version if package.json can't be read
    return '1.0.3';
  }
}

export const version = getVersion();

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && !defaultValue) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || defaultValue || '';
}

export function getConfig(): ServerConfig {
  return {
    socialApiBaseUrl: getEnvVar(ENV_KEYS.SOCIALMEDIA_API_BASE_URL),
    socialApiKey: getEnvVar(ENV_KEYS.SOCIALMEDIA_API_KEY),
    teamName: getEnvVar(ENV_KEYS.SOCIALMEDIA_TEAM_ID),
    port: Number.parseInt(getEnvVar(ENV_KEYS.PORT, '3000'), 10),
    logLevel: getEnvVar(ENV_KEYS.LOG_LEVEL, 'info'),
    apiTimeout: Number.parseInt(getEnvVar(ENV_KEYS.API_TIMEOUT, '30000'), 10), // 30 seconds default
  };
}

export const config: ServerConfig = getConfig();

export function validateConfig(): void {
  const errors: string[] = [];

  try {
    const conf = getConfig();

    if (!conf.socialApiBaseUrl) {
      errors.push(`${ENV_KEYS.SOCIALMEDIA_API_BASE_URL} is required`);
    }

    if (!conf.socialApiKey) {
      errors.push(`${ENV_KEYS.SOCIALMEDIA_API_KEY} is required`);
    }

    if (!conf.teamName) {
      errors.push(`${ENV_KEYS.SOCIALMEDIA_TEAM_ID} is required`);
    }

    if (Number.isNaN(conf.port) || conf.port < 1 || conf.port > 65535) {
      errors.push(`${ENV_KEYS.PORT} must be a valid port number (1-65535)`);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}
