// ABOUTME: Login tool implementation for agent authentication
// ABOUTME: Handles session creation and validation for agents

import { SessionManager } from '../session-manager.js';
import { LoginToolResponse } from '../types.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { withMetrics } from '../metrics.js';
import { z } from 'zod';
import { validateLoginInput } from '../validation.js';

export const loginToolSchema = {
  description: 'Authenticate and set agent identity for the session',
  inputSchema: {
    agent_name: z.string().min(1).describe('The name of the agent logging in'),
  },
};

export interface LoginToolContext {
  sessionManager: SessionManager;
  getSessionId: () => string;
}

export async function loginToolHandler(
  input: any,
  context: LoginToolContext
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
          details: validation.errors.map((e) => `${e.field}: ${e.message}`).join(', '),
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

      const { agent_name } = validation.data;

      // Check if session already exists (re-login scenario)
      const existingSession = context.sessionManager.getSession(sessionId);

      if (existingSession) {
        // Update existing session
        await context.sessionManager.createSession(sessionId, agent_name.trim());

        const response: LoginToolResponse = {
          success: true,
          agent_name: agent_name.trim(),
          team_name: config.teamName,
          session_id: sessionId,
        };

        logger.info('Re-login successful', {
          sessionId,
          agentName: agent_name.trim(),
          previousAgent: existingSession.agentName,
        });

        logger.toolSuccess('login', Date.now() - startTime, {
          sessionId,
          agentName: agent_name.trim(),
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
      const session = await context.sessionManager.createSession(sessionId, agent_name.trim());

      logger.sessionCreated(sessionId, agent_name.trim());

      const response: LoginToolResponse = {
        success: true,
        agent_name: session.agentName,
        team_name: config.teamName,
        session_id: session.sessionId,
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
