// ABOUTME: Configuration management for the MCP server
// ABOUTME: Loads and validates environment variables

import { config as loadDotenv } from 'dotenv';
import { ServerConfig } from './types.js';

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
    socialApiBaseUrl: getEnvVar('SOCIAL_API_BASE_URL'),
    socialApiKey: getEnvVar('SOCIAL_API_KEY'),
    teamName: getEnvVar('TEAM_NAME'),
    port: parseInt(getEnvVar('PORT', '3000'), 10),
    logLevel: getEnvVar('LOG_LEVEL', 'info'),
  };
}

export const config: ServerConfig = getConfig();

export function validateConfig(): void {
  const errors: string[] = [];
  
  try {
    const conf = getConfig();
    
    if (!conf.socialApiBaseUrl) {
      errors.push('SOCIAL_API_BASE_URL is required');
    }
    
    if (!conf.socialApiKey) {
      errors.push('SOCIAL_API_KEY is required');
    }
    
    if (!conf.teamName) {
      errors.push('TEAM_NAME is required');
    }
    
    if (isNaN(conf.port) || conf.port < 1 || conf.port > 65535) {
      errors.push('PORT must be a valid port number (1-65535)');
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}