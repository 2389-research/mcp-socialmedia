// ABOUTME: Agent resource handlers for reading agent profiles and posts
// ABOUTME: Implements resource callbacks for agent-related URIs
import { config } from '../config.js';
import { logger } from '../logger.js';
/**
 * Read an agent's profile
 * URI: social://agents/{agentName}/profile
 */
export async function readAgentProfileResource(uri, context) {
    try {
        // Extract agentName from URI path
        const pathMatch = uri.pathname.match(/^\/\/agents\/([^/]+)\/profile$/);
        const agentName = pathMatch?.[1];
        if (!agentName) {
            return {
                contents: [
                    {
                        uri: uri.toString(),
                        mimeType: 'application/json',
                        text: JSON.stringify({ error: 'Invalid agent profile URI: missing agentName' }),
                    },
                ],
            };
        }
        logger.debug('Reading agent profile resource', { agentName });
        // Fetch all posts by this agent to build profile
        const response = await context.apiClient.fetchPosts(config.teamName, {
            agent_filter: agentName,
            limit: 100,
            offset: 0,
        });
        // Calculate profile stats
        let firstSeenAt;
        let lastSeenAt;
        if (response.posts.length > 0) {
            const timestamps = response.posts.map((p) => p.timestamp);
            timestamps.sort();
            firstSeenAt = timestamps[0];
            lastSeenAt = timestamps[timestamps.length - 1];
        }
        const resource = {
            profile: {
                agentName,
                postCount: response.total || response.posts.length,
                firstSeenAt,
                lastSeenAt,
            },
        };
        return {
            contents: [
                {
                    uri: uri.toString(),
                    mimeType: 'application/json',
                    text: JSON.stringify(resource, null, 2),
                },
            ],
        };
    }
    catch (error) {
        logger.error('Error reading agent profile resource', { error, uri: uri.toString() });
        return {
            contents: [
                {
                    uri: uri.toString(),
                    mimeType: 'application/json',
                    text: JSON.stringify({
                        error: 'Failed to read agent profile resource',
                        details: error instanceof Error ? error.message : 'Unknown error',
                    }),
                },
            ],
        };
    }
}
/**
 * Read an agent's posts
 * URI: social://agents/{agentName}/posts
 */
export async function readAgentPostsResource(uri, context) {
    try {
        // Extract agentName from URI path
        const pathMatch = uri.pathname.match(/^\/\/agents\/([^/]+)\/posts$/);
        const agentName = pathMatch?.[1];
        if (!agentName) {
            return {
                contents: [
                    {
                        uri: uri.toString(),
                        mimeType: 'application/json',
                        text: JSON.stringify({ error: 'Invalid agent posts URI: missing agentName' }),
                    },
                ],
            };
        }
        logger.debug('Reading agent posts resource', { agentName });
        // Fetch posts by this agent
        const response = await context.apiClient.fetchPosts(config.teamName, {
            agent_filter: agentName,
            limit: 50, // Reasonable default
            offset: 0,
        });
        const resource = {
            agentName,
            posts: response.posts.map((p) => ({
                id: p.id,
                content: p.content,
                tags: p.tags,
                timestamp: p.timestamp,
                parent_post_id: p.parent_post_id,
            })),
            total: response.total || response.posts.length,
        };
        return {
            contents: [
                {
                    uri: uri.toString(),
                    mimeType: 'application/json',
                    text: JSON.stringify(resource, null, 2),
                },
            ],
        };
    }
    catch (error) {
        logger.error('Error reading agent posts resource', { error, uri: uri.toString() });
        return {
            contents: [
                {
                    uri: uri.toString(),
                    mimeType: 'application/json',
                    text: JSON.stringify({
                        error: 'Failed to read agent posts resource',
                        details: error instanceof Error ? error.message : 'Unknown error',
                    }),
                },
            ],
        };
    }
}
//# sourceMappingURL=agents.js.map