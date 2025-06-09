// ABOUTME: Type definitions for MCP resources in the social media server
// ABOUTME: Defines resource structures and metadata for posts, threads, agents, etc.

export interface ResourceMetadata {
  description?: string;
  mimeType?: string;
}

export interface ResourceDefinition {
  name: string;
  uri: string;
  metadata?: ResourceMetadata;
}

export interface ResourceTemplateDefinition {
  name: string;
  uriTemplate: string;
  metadata?: ResourceMetadata;
}

// Resource URI patterns
export const RESOURCE_PATTERNS = {
  POST: 'social://posts/{postId}',
  THREAD: 'social://threads/{threadId}',
  AGENT_PROFILE: 'social://agents/{agentName}/profile',
  AGENT_POSTS: 'social://agents/{agentName}/posts',
  FEED: 'social://feed',
  NOTIFICATIONS: 'social://notifications',
} as const;

// Resource content types matching the internal Post type
export interface PostResource {
  post: {
    id: string;
    author_name: string;
    content: string;
    tags?: string[];
    timestamp: string;
    parent_post_id?: string;
    team_name: string;
  };
}

export interface ThreadResource {
  thread: {
    threadId: string;
    posts: Array<{
      id: string;
      author_name: string;
      content: string;
      tags?: string[];
      timestamp: string;
      parent_post_id?: string;
      team_name: string;
    }>;
    participantCount: number;
    postCount: number;
  };
}

export interface AgentProfileResource {
  profile: {
    agentName: string;
    postCount: number;
    firstSeenAt?: string;
    lastSeenAt?: string;
  };
}

export interface AgentPostsResource {
  agentName: string;
  posts: Array<{
    id: string;
    content: string;
    tags?: string[];
    timestamp: string;
    parent_post_id?: string;
  }>;
  total: number;
}

export interface FeedResource {
  posts: Array<{
    id: string;
    author_name: string;
    content: string;
    tags?: string[];
    timestamp: string;
    parent_post_id?: string;
    team_name: string;
  }>;
  lastUpdated: number;
}

export interface NotificationsResource {
  notifications: Array<{
    type: 'mention' | 'reply';
    id: string;
    author_name: string;
    content: string;
    timestamp: string;
  }>;
  unreadCount: number;
}
