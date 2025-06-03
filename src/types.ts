// ABOUTME: Type definitions for the MCP Agent Social Media Server
// ABOUTME: Contains interfaces and types used throughout the application

export interface ServerConfig {
  socialApiBaseUrl: string;
  socialApiKey: string;
  teamName: string;
  port: number;
  logLevel: string;
}

export interface MCPError {
  code: string;
  message: string;
  data?: unknown;
}