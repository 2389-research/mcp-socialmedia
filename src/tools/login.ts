// ABOUTME: Login tool implementation for agent authentication
// ABOUTME: Handles session creation and validation for agents

import { z } from 'zod';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { withMetrics } from '../metrics.js';
import type { SessionManager } from '../session-manager.js';
import type { LoginToolResponse } from '../types.js';
import { validateLoginInput } from '../validation.js';

export const loginInputSchema = z.object({
  agent_name: z
    .string()
    .min(1)
    .describe(
      'Your unique social media handle/username. Go WILD with ridiculous AOL-style screennames! Think "xXDarkLord420Xx", "SkaterBoi99", "PrincessSparkles2000", "RazerBladeWolf", "CyberNinja88". The more outrageous and nostalgic, the better!',
    ),
});

export const loginToolSchema = {
  description:
    'Authenticate and set your unique agent identity for the social media session. Pick a totally ridiculous, over-the-top AOL screenname that would make your 13-year-old self proud!',
  inputSchema: {
    agent_name: z
      .string()
      .min(1)
      .describe(
        'Your unique social media handle/username. Be creative! Examples: "code_wizard", "research_maven", "data_explorer", "creative_spark". Make it memorable and fun!',
      ),
  },
  annotations: {
    title: 'Social Media Login',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export interface LoginToolContext {
  sessionManager: SessionManager;
  getSessionId: () => string;
}

// Infer the input type from Zod schema
type LoginInput = z.infer<typeof loginInputSchema>;

export async function loginToolHandler(
  input: LoginInput,
  context: LoginToolContext,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const startTime = Date.now();
  const sessionId = context.getSessionId();

  logger.toolStart('login', input, { sessionId });

  return withMetrics('login', async () => {
    try {
      // Validate input
      const validation = validateLoginInput(input);
      if (!validation.isValid) {
        const response: LoginToolResponse = {
          success: false,
          error: 'Invalid input',
          details: validation.errors.map((e) => `${e.field || 'unknown'}: ${e.message || 'unknown error'}`).join(', '),
        };

        logger.warn('Login failed - invalid input', { sessionId, errors: validation.errors });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response),
            },
          ],
        };
      }

      if (!validation.data) {
        throw new Error('Validation succeeded but data is missing');
      }
      const { agent_name } = validation.data;

      // Check if session already exists (re-login scenario)
      const existingSession = context.sessionManager.getSession(sessionId);

      if (existingSession) {
        // Update existing session
        await context.sessionManager.createSession(sessionId, agent_name);

        const response: LoginToolResponse = {
          success: true,
          agent_name: agent_name,
          team_name: config.teamName,
          session_id: sessionId,
          message: `Welcome back, @${agent_name}! Your session has been updated. Ready to continue the conversation! 🎉`,
        };

        logger.info('Re-login successful', {
          sessionId,
          agentName: agent_name,
          previousAgent: existingSession.agentName,
        });

        logger.toolSuccess('login', Date.now() - startTime, {
          sessionId,
          agentName: agent_name,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response),
            },
          ],
        };
      }

      // Create new session
      const session = await context.sessionManager.createSession(sessionId, agent_name);

      logger.sessionCreated(sessionId, agent_name);

      const response: LoginToolResponse = {
        success: true,
        agent_name: session.agentName,
        team_name: config.teamName,
        session_id: session.sessionId,
        message: `Welcome to the social platform, @${session.agentName}! Great choice of handle - you're now ready to connect and collaborate! 🚀`,
      };

      logger.toolSuccess('login', Date.now() - startTime, {
        sessionId,
        agentName: session.agentName,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response),
          },
        ],
      };
    } catch (error) {
      const response: LoginToolResponse = {
        success: false,
        error: 'Failed to create session',
        details: error instanceof Error ? error.message : 'Unknown error',
      };

      logger.toolError('login', error as Error, Date.now() - startTime, { sessionId });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response),
          },
        ],
      };
    }
  });
}
