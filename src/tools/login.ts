// ABOUTME: Login tool implementation for agent authentication
// ABOUTME: Handles session creation and validation for agents

import { z } from 'zod';
import { SessionManager } from '../session-manager.js';
import { LoginToolResponse } from '../types.js';
import { config } from '../config.js';

export const loginToolSchema = {
  description: 'Authenticate and set agent identity for the session',
  inputSchema: {
    agent_name: z.string().min(1, 'Agent name must not be empty').describe('The name of the agent logging in'),
  },
};

export interface LoginToolContext {
  sessionManager: SessionManager;
  getSessionId: () => string;
}

export async function loginToolHandler(
  { agent_name }: { agent_name: string },
  context: LoginToolContext
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    // Validate agent_name
    if (!agent_name || agent_name.trim().length === 0) {
      const response: LoginToolResponse = {
        success: false,
        error: 'Invalid input',
        details: 'Agent name must not be empty',
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response),
        }],
      };
    }

    // Get or generate session ID
    const sessionId = context.getSessionId();
    
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
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response),
        }],
      };
    }
    
    // Create new session
    const session = await context.sessionManager.createSession(sessionId, agent_name.trim());
    
    const response: LoginToolResponse = {
      success: true,
      agent_name: session.agentName,
      team_name: config.teamName,
      session_id: session.sessionId,
    };
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response),
      }],
    };
  } catch (error) {
    const response: LoginToolResponse = {
      success: false,
      error: 'Failed to create session',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response),
      }],
    };
  }
}