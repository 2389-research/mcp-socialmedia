// ABOUTME: Tests for prompts type definitions and Zod schemas
// ABOUTME: Validates TypeScript interfaces and schema validation logic

import { jest } from '@jest/globals';
import { z } from 'zod';
import {
  type PromptMessage,
  type PromptTemplate,
  agentNameSchema,
  postContentSchema,
  threadIdSchema,
  timeRangeSchema,
  topicSchema,
} from '../../src/prompts/types.js';

describe('Prompts Types', () => {
  describe('PromptMessage Interface', () => {
    test('should accept valid user message', () => {
      const message: PromptMessage = {
        role: 'user',
        content: {
          type: 'text',
          text: 'Hello, world!',
        },
      };

      expect(message.role).toBe('user');
      expect(message.content.type).toBe('text');
      expect(message.content.text).toBe('Hello, world!');
    });

    test('should accept valid assistant message', () => {
      const message: PromptMessage = {
        role: 'assistant',
        content: {
          type: 'text',
          text: 'Hello! How can I help you today?',
        },
      };

      expect(message.role).toBe('assistant');
      expect(message.content.type).toBe('text');
      expect(message.content.text).toBe('Hello! How can I help you today?');
    });

    test('should handle empty text content', () => {
      const message: PromptMessage = {
        role: 'user',
        content: {
          type: 'text',
          text: '',
        },
      };

      expect(message.content.text).toBe('');
    });

    test('should handle multiline text content', () => {
      const multilineText = `This is a
multiline message with
multiple lines of text.`;

      const message: PromptMessage = {
        role: 'user',
        content: {
          type: 'text',
          text: multilineText,
        },
      };

      expect(message.content.text).toBe(multilineText);
      expect(message.content.text.split('\n')).toHaveLength(3);
    });

    test('should handle special characters in text', () => {
      const specialText = 'Hello! 🚀 This has "quotes" and <tags> and &entities;';

      const message: PromptMessage = {
        role: 'assistant',
        content: {
          type: 'text',
          text: specialText,
        },
      };

      expect(message.content.text).toBe(specialText);
    });
  });

  describe('PromptTemplate Interface', () => {
    test('should accept minimal template with required fields', () => {
      const template: PromptTemplate = {
        name: 'simple-prompt',
        messages: [
          {
            role: 'user',
            content: { type: 'text', text: 'Test message' },
          },
        ],
      };

      expect(template.name).toBe('simple-prompt');
      expect(template.messages).toHaveLength(1);
      expect(template.description).toBeUndefined();
      expect(template.arguments).toBeUndefined();
    });

    test('should accept complete template with all fields', () => {
      const template: PromptTemplate = {
        name: 'complex-prompt',
        description: 'A complex prompt template for testing',
        arguments: {
          user_input: z.string(),
          optional_context: z.string().optional(),
        },
        messages: [
          {
            role: 'user',
            content: { type: 'text', text: 'User message' },
          },
          {
            role: 'assistant',
            content: { type: 'text', text: 'Assistant response' },
          },
        ],
      };

      expect(template.name).toBe('complex-prompt');
      expect(template.description).toBe('A complex prompt template for testing');
      expect(template.arguments).toBeDefined();
      expect(template.messages).toHaveLength(2);
    });

    test('should handle empty messages array', () => {
      const template: PromptTemplate = {
        name: 'empty-prompt',
        messages: [],
      };

      expect(template.messages).toEqual([]);
      expect(template.messages).toHaveLength(0);
    });

    test('should handle conversation with multiple messages', () => {
      const conversation: PromptMessage[] = [
        { role: 'user', content: { type: 'text', text: 'Hello' } },
        { role: 'assistant', content: { type: 'text', text: 'Hi there!' } },
        { role: 'user', content: { type: 'text', text: 'How are you?' } },
        { role: 'assistant', content: { type: 'text', text: 'I am doing well, thank you!' } },
      ];

      const template: PromptTemplate = {
        name: 'conversation-prompt',
        description: 'Multi-turn conversation',
        messages: conversation,
      };

      expect(template.messages).toHaveLength(4);
      expect(template.messages[0].role).toBe('user');
      expect(template.messages[1].role).toBe('assistant');
      expect(template.messages[2].role).toBe('user');
      expect(template.messages[3].role).toBe('assistant');
    });

    test('should handle complex argument definitions', () => {
      const template: PromptTemplate = {
        name: 'args-prompt',
        arguments: {
          required_string: z.string(),
          optional_string: z.string().optional(),
          required_with_desc: z.string().describe('A required string with description'),
          optional_with_desc: z.string().optional().describe('An optional string with description'),
        },
        messages: [{ role: 'user', content: { type: 'text', text: 'Test with args' } }],
      };

      expect(Object.keys(template.arguments ?? {})).toHaveLength(4);
      expect(template.arguments?.required_string).toBeDefined();
      expect(template.arguments?.optional_string).toBeDefined();
    });
  });

  describe('Schema Validations', () => {
    describe('threadIdSchema', () => {
      test('should validate valid thread ID', () => {
        const schema = z.object(threadIdSchema);
        const validData = { thread_id: 'thread-123' };

        const result = schema.parse(validData);
        expect(result.thread_id).toBe('thread-123');
      });

      test('should reject missing thread ID', () => {
        const schema = z.object(threadIdSchema);
        const invalidData = {};

        expect(() => schema.parse(invalidData)).toThrow();
      });

      test('should reject non-string thread ID', () => {
        const schema = z.object(threadIdSchema);
        const invalidData = { thread_id: 123 };

        expect(() => schema.parse(invalidData)).toThrow();
      });

      test('should accept empty string thread ID', () => {
        const schema = z.object(threadIdSchema);
        const data = { thread_id: '' };

        const result = schema.parse(data);
        expect(result.thread_id).toBe('');
      });

      test('should accept UUID format thread ID', () => {
        const schema = z.object(threadIdSchema);
        const data = { thread_id: '550e8400-e29b-41d4-a716-446655440000' };

        const result = schema.parse(data);
        expect(result.thread_id).toBe('550e8400-e29b-41d4-a716-446655440000');
      });
    });

    describe('agentNameSchema', () => {
      test('should validate valid agent name', () => {
        const schema = z.object(agentNameSchema);
        const validData = { agent_name: 'TestAgent' };

        const result = schema.parse(validData);
        expect(result.agent_name).toBe('TestAgent');
      });

      test('should reject missing agent name', () => {
        const schema = z.object(agentNameSchema);
        const invalidData = {};

        expect(() => schema.parse(invalidData)).toThrow();
      });

      test('should reject non-string agent name', () => {
        const schema = z.object(agentNameSchema);
        const invalidData = { agent_name: 123 };

        expect(() => schema.parse(invalidData)).toThrow();
      });

      test('should accept agent names with special characters', () => {
        const schema = z.object(agentNameSchema);
        const specialNames = [
          'agent-with-dashes',
          'agent_with_underscores',
          'agent123',
          'Agent With Spaces',
          'agent@domain.com',
        ];

        for (const name of specialNames) {
          const data = { agent_name: name };
          const result = schema.parse(data);
          expect(result.agent_name).toBe(name);
        }
      });
    });

    describe('postContentSchema', () => {
      test('should validate post content with required field only', () => {
        const schema = z.object(postContentSchema);
        const validData = { post_content: 'Hello, world!' };

        const result = schema.parse(validData);
        expect(result.post_content).toBe('Hello, world!');
        expect(result.context).toBeUndefined();
      });

      test('should validate post content with optional context', () => {
        const schema = z.object(postContentSchema);
        const validData = {
          post_content: 'Hello, world!',
          context: 'This is additional context',
        };

        const result = schema.parse(validData);
        expect(result.post_content).toBe('Hello, world!');
        expect(result.context).toBe('This is additional context');
      });

      test('should reject missing post content', () => {
        const schema = z.object(postContentSchema);
        const invalidData = { context: 'Just context' };

        expect(() => schema.parse(invalidData)).toThrow();
      });

      test('should accept empty post content', () => {
        const schema = z.object(postContentSchema);
        const data = { post_content: '' };

        const result = schema.parse(data);
        expect(result.post_content).toBe('');
      });

      test('should handle multiline post content', () => {
        const schema = z.object(postContentSchema);
        const multilineContent = `This is a
multiline post with
multiple paragraphs.`;

        const data = {
          post_content: multilineContent,
          context: 'Multiline content test',
        };

        const result = schema.parse(data);
        expect(result.post_content).toBe(multilineContent);
        expect(result.context).toBe('Multiline content test');
      });

      test('should accept empty context', () => {
        const schema = z.object(postContentSchema);
        const data = {
          post_content: 'Test content',
          context: '',
        };

        const result = schema.parse(data);
        expect(result.context).toBe('');
      });
    });

    describe('topicSchema', () => {
      test('should validate topic with required field only', () => {
        const schema = z.object(topicSchema);
        const validData = { topic: 'technology' };

        const result = schema.parse(validData);
        expect(result.topic).toBe('technology');
        expect(result.limit).toBeUndefined();
      });

      test('should validate topic with optional limit', () => {
        const schema = z.object(topicSchema);
        const validData = {
          topic: 'science',
          limit: '10',
        };

        const result = schema.parse(validData);
        expect(result.topic).toBe('science');
        expect(result.limit).toBe('10');
      });

      test('should reject missing topic', () => {
        const schema = z.object(topicSchema);
        const invalidData = { limit: '5' };

        expect(() => schema.parse(invalidData)).toThrow();
      });

      test('should handle numeric limit as string', () => {
        const schema = z.object(topicSchema);
        const data = {
          topic: 'programming',
          limit: '25',
        };

        const result = schema.parse(data);
        expect(result.limit).toBe('25');
      });

      test('should handle zero limit', () => {
        const schema = z.object(topicSchema);
        const data = {
          topic: 'testing',
          limit: '0',
        };

        const result = schema.parse(data);
        expect(result.limit).toBe('0');
      });

      test('should handle various topic formats', () => {
        const schema = z.object(topicSchema);
        const topics = [
          'single-word',
          'multiple words topic',
          'topic_with_underscores',
          'topic-with-dashes',
          'topic123',
          '#hashtag',
          '@mention',
        ];

        for (const topic of topics) {
          const data = { topic };
          const result = schema.parse(data);
          expect(result.topic).toBe(topic);
        }
      });
    });

    describe('timeRangeSchema', () => {
      test('should validate with no fields (all optional)', () => {
        const schema = z.object(timeRangeSchema);
        const validData = {};

        const result = schema.parse(validData);
        expect(result.start_date).toBeUndefined();
        expect(result.end_date).toBeUndefined();
        expect(result.agent_filter).toBeUndefined();
      });

      test('should validate with all fields provided', () => {
        const schema = z.object(timeRangeSchema);
        const validData = {
          start_date: '2023-01-01T00:00:00Z',
          end_date: '2023-12-31T23:59:59Z',
          agent_filter: 'TestAgent',
        };

        const result = schema.parse(validData);
        expect(result.start_date).toBe('2023-01-01T00:00:00Z');
        expect(result.end_date).toBe('2023-12-31T23:59:59Z');
        expect(result.agent_filter).toBe('TestAgent');
      });

      test('should validate with only start date', () => {
        const schema = z.object(timeRangeSchema);
        const data = { start_date: '2023-06-01T00:00:00Z' };

        const result = schema.parse(data);
        expect(result.start_date).toBe('2023-06-01T00:00:00Z');
        expect(result.end_date).toBeUndefined();
        expect(result.agent_filter).toBeUndefined();
      });

      test('should validate with only end date', () => {
        const schema = z.object(timeRangeSchema);
        const data = { end_date: '2023-06-30T23:59:59Z' };

        const result = schema.parse(data);
        expect(result.start_date).toBeUndefined();
        expect(result.end_date).toBe('2023-06-30T23:59:59Z');
        expect(result.agent_filter).toBeUndefined();
      });

      test('should validate with only agent filter', () => {
        const schema = z.object(timeRangeSchema);
        const data = { agent_filter: 'SpecificAgent' };

        const result = schema.parse(data);
        expect(result.start_date).toBeUndefined();
        expect(result.end_date).toBeUndefined();
        expect(result.agent_filter).toBe('SpecificAgent');
      });

      test('should handle various ISO date formats', () => {
        const schema = z.object(timeRangeSchema);
        const dateFormats = [
          '2023-01-01',
          '2023-01-01T10:30:00',
          '2023-01-01T10:30:00Z',
          '2023-01-01T10:30:00+02:00',
          '2023-01-01T10:30:00.123Z',
        ];

        for (const dateFormat of dateFormats) {
          const data = { start_date: dateFormat };
          const result = schema.parse(data);
          expect(result.start_date).toBe(dateFormat);
        }
      });

      test('should handle empty string values', () => {
        const schema = z.object(timeRangeSchema);
        const data = {
          start_date: '',
          end_date: '',
          agent_filter: '',
        };

        const result = schema.parse(data);
        expect(result.start_date).toBe('');
        expect(result.end_date).toBe('');
        expect(result.agent_filter).toBe('');
      });
    });
  });

  describe('Schema Integration', () => {
    test('should combine multiple schemas', () => {
      const combinedSchema = z.object({
        ...threadIdSchema,
        ...agentNameSchema,
        ...postContentSchema,
      });

      const data = {
        thread_id: 'thread-456',
        agent_name: 'CombinedAgent',
        post_content: 'Combined test content',
        context: 'Integration test context',
      };

      const result = combinedSchema.parse(data);
      expect(result.thread_id).toBe('thread-456');
      expect(result.agent_name).toBe('CombinedAgent');
      expect(result.post_content).toBe('Combined test content');
      expect(result.context).toBe('Integration test context');
    });

    test('should handle partial schemas', () => {
      const partialSchema = z.object({
        ...topicSchema,
        ...timeRangeSchema,
      });

      const data = {
        topic: 'partial-test',
        start_date: '2023-01-01T00:00:00Z',
        // limit and end_date are optional and omitted
      };

      const result = partialSchema.parse(data);
      expect(result.topic).toBe('partial-test');
      expect(result.start_date).toBe('2023-01-01T00:00:00Z');
      expect(result.limit).toBeUndefined();
      expect(result.end_date).toBeUndefined();
    });

    test('should validate complex nested data structure', () => {
      const complexSchema = z.object({
        metadata: z.object({
          ...threadIdSchema,
          ...agentNameSchema,
        }),
        content: z.object({
          ...postContentSchema,
        }),
        filters: z.object({
          ...topicSchema,
          ...timeRangeSchema,
        }),
      });

      const complexData = {
        metadata: {
          thread_id: 'complex-thread',
          agent_name: 'ComplexAgent',
        },
        content: {
          post_content: 'Complex nested content',
          context: 'Nested context',
        },
        filters: {
          topic: 'complex-topic',
          limit: '15',
          start_date: '2023-01-01T00:00:00Z',
          agent_filter: 'FilterAgent',
        },
      };

      const result = complexSchema.parse(complexData);
      expect(result.metadata.thread_id).toBe('complex-thread');
      expect(result.metadata.agent_name).toBe('ComplexAgent');
      expect(result.content.post_content).toBe('Complex nested content');
      expect(result.filters.topic).toBe('complex-topic');
      expect(result.filters.limit).toBe('15');
    });
  });

  describe('Type Safety', () => {
    test('should ensure type safety for PromptMessage', () => {
      const messages: PromptMessage[] = [
        { role: 'user', content: { type: 'text', text: 'User message' } },
        { role: 'assistant', content: { type: 'text', text: 'Assistant message' } },
      ];

      for (const message of messages) {
        expect(['user', 'assistant']).toContain(message.role);
        expect(message.content.type).toBe('text');
        expect(typeof message.content.text).toBe('string');
      }
    });

    test('should ensure type safety for PromptTemplate', () => {
      const template: PromptTemplate = {
        name: 'type-safety-test',
        description: 'Testing type safety',
        arguments: {
          test_arg: z.string(),
          optional_arg: z.string().optional(),
        },
        messages: [{ role: 'user', content: { type: 'text', text: 'Test message' } }],
      };

      expect(typeof template.name).toBe('string');
      expect(typeof template.description).toBe('string');
      expect(Array.isArray(template.messages)).toBe(true);
      expect(typeof template.arguments).toBe('object');
      expect(template.arguments?.test_arg).toBeDefined();
      expect(template.arguments?.optional_arg).toBeDefined();
    });
  });
});
