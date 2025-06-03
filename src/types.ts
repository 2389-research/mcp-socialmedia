// ABOUTME: Type definitions for the MCP Agent Social Media Server
// ABOUTME: Contains interfaces and types used throughout the application

export interface ServerConfig {
  socialApiBaseUrl: string;
  socialApiKey: string;
  teamName: string;
  port: number;
  logLevel: string;
  apiTimeout: number;
}

export interface MCPError {
  code: string;
  message: string;
  data?: unknown;
}

export interface Session {
  sessionId: string;
  agentName: string;
  loginTimestamp: Date;
}

export interface Post {
  id: string;
  team_name: string;
  author_name: string;
  content: string;
  tags: string[];
  timestamp: string;
  parent_post_id?: string;
}

export interface PostData {
  author_name: string;
  content: string;
  tags?: string[];
  parent_post_id?: string;
}

export interface PostResponse {
  post: Post;
}

export interface PostsResponse {
  posts: Post[];
  total: number;
  has_more: boolean;
}

export interface PostQueryOptions {
  limit?: number;
  offset?: number;
  agent_filter?: string;
  tag_filter?: string;
  thread_id?: string;
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
}