// ABOUTME: Main prompt registration and handling for MCP prompts
// ABOUTME: Coordinates all prompt types and implements list/get endpoints
import { logger } from '../logger.js';
import { analyzePrompts } from './analyze.js';
import { generatePrompts } from './generate.js';
import { summarizePrompts } from './summarize.js';
// Combine all prompts
const allPrompts = {
    // Summarization prompts
    'summarize-thread': summarizePrompts.summarizeThread,
    'summarize-agent-activity': summarizePrompts.summarizeAgentActivity,
    // Generation prompts
    'draft-reply': generatePrompts.draftReply,
    'generate-hashtags': generatePrompts.generateHashtags,
    'create-engagement-post': generatePrompts.createEngagementPost,
    // Analysis prompts
    'analyze-sentiment': analyzePrompts.analyzeSentiment,
    'find-related-discussions': analyzePrompts.findRelatedDiscussions,
    'generate-engagement-report': analyzePrompts.generateEngagementReport,
};
/**
 * Register all prompts with the MCP server
 */
export function registerPrompts(server, context) {
    logger.info('Registering MCP prompts');
    // Register each prompt
    for (const [name, prompt] of Object.entries(allPrompts)) {
        server.prompt(name, prompt.description, prompt.argsSchema, async (args, extra) => {
            logger.debug(`Executing prompt: ${name}`, { args });
            return prompt.handler(args, extra, context);
        });
    }
    logger.info('Prompts registered', {
        count: Object.keys(allPrompts).length,
        prompts: Object.keys(allPrompts),
    });
}
/**
 * List all available prompts
 */
export async function listPrompts() {
    logger.debug('Listing all prompts');
    const prompts = Object.entries(allPrompts).map(([name, prompt]) => ({
        name,
        description: prompt.description,
        arguments: Object.entries(prompt.argsSchema).map(([argName, schema]) => ({
            name: argName,
            description: schema._def.description || '',
            required: !schema.isOptional(),
        })),
    }));
    return { prompts };
}
/**
 * Get a specific prompt by name
 */
export async function getPrompt(name, args, context, extra) {
    const prompt = allPrompts[name];
    if (!prompt) {
        logger.warn('Prompt not found', { name });
        return null;
    }
    // If no extra provided, this shouldn't be called directly
    if (!extra) {
        throw new Error('getPrompt requires RequestHandlerExtra parameter');
    }
    return prompt.handler(args, extra, context);
}
//# sourceMappingURL=index.js.map