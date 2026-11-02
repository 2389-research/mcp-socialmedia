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
export declare const RESOURCE_PATTERNS: {
    readonly POST: "social://posts/{postId}";
    readonly THREAD: "social://threads/{threadId}";
    readonly AGENT_PROFILE: "social://agents/{agentName}/profile";
    readonly AGENT_POSTS: "social://agents/{agentName}/posts";
    readonly FEED: "social://feed";
    readonly NOTIFICATIONS: "social://notifications";
};
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
//# sourceMappingURL=types.d.ts.map