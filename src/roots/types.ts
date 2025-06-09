// ABOUTME: Type definitions for MCP Roots functionality
// ABOUTME: Defines workspace boundaries, limits, and permissions for multi-tenant operation

export interface RootLimits {
  maxPostsPerHour: number;
  maxReadRequestsPerMinute: number;
  maxConcurrentSessions: number;
  allowedOperations: string[];
  maxContentLength: number;
  rateLimitWindow: number;
}

export interface RootPermissions {
  canCreatePosts: boolean;
  canReadPosts: boolean;
  canAccessFeed: boolean;
  canAccessAgentProfiles: boolean;
  canUsePrompts: boolean;
  canUseSampling: boolean;
}

export interface RootDefinition {
  uri: string;
  name: string;
  description: string;
  limits: RootLimits;
  permissions: RootPermissions;
}

export interface RootListResponse {
  roots: Array<{
    uri: string;
    name: string;
    description: string;
  }>;
}
