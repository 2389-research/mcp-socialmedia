// ABOUTME: Sampling template processors for various content generation tasks
// ABOUTME: Provides pre-configured templates for common social media use cases

import { logger } from '../logger.js';
import { type Message, type TemplateProcessor } from './types.js';

class PostContentTemplate implements TemplateProcessor {
  name = 'post-content';
  description = 'Generate engaging social media post content';

  async process(messages: Message[], context: any): Promise<Message[]> {
    const systemPrompt: Message = {
      role: 'system',
      content: `You are a social media content creator. Generate engaging, authentic posts that:
- Are conversational and relatable
- Include relevant hashtags when appropriate
- Stay within social media best practices
- Match the tone of the requesting agent
- Are concise but impactful`
    };

    return [systemPrompt, ...messages];
  }
}

class ReplyTemplate implements TemplateProcessor {
  name = 'reply-suggestion';
  description = 'Generate contextual reply suggestions';

  async process(messages: Message[], context: any): Promise<Message[]> {
    const systemPrompt: Message = {
      role: 'system',
      content: `You are helping generate thoughtful replies to social media posts. Create responses that:
- Are relevant to the conversation context
- Add value to the discussion
- Maintain a professional yet friendly tone
- Are concise and to the point
- Show genuine engagement with the topic`
    };

    return [systemPrompt, ...messages];
  }
}

class TranslationTemplate implements TemplateProcessor {
  name = 'translation';
  description = 'Translate content while preserving social media context';

  async process(messages: Message[], context: any): Promise<Message[]> {
    const systemPrompt: Message = {
      role: 'system',
      content: `You are a social media translator. When translating content:
- Preserve the original tone and style
- Adapt hashtags and mentions appropriately
- Keep cultural context in mind
- Maintain the same level of formality
- Preserve emojis and formatting where possible`
    };

    return [systemPrompt, ...messages];
  }
}

class SummaryTemplate implements TemplateProcessor {
  name = 'summary';
  description = 'Generate concise summaries of social media content';

  async process(messages: Message[], context: any): Promise<Message[]> {
    const systemPrompt: Message = {
      role: 'system',
      content: `You are a content summarizer for social media. Create summaries that:
- Capture the key points and main themes
- Maintain the original sentiment
- Are significantly shorter than the original
- Highlight important discussions or decisions
- Use clear, accessible language`
    };

    return [systemPrompt, ...messages];
  }
}

export class SamplingTemplates {
  private static templates: Map<string, TemplateProcessor> = new Map();

  static {
    // Register all available templates
    const templateInstances = [
      new PostContentTemplate(),
      new ReplyTemplate(),
      new TranslationTemplate(),
      new SummaryTemplate()
    ];

    for (const template of templateInstances) {
      this.templates.set(template.name, template);
    }

    logger.info('Sampling templates registered', {
      count: this.templates.size,
      templates: Array.from(this.templates.keys())
    });
  }

  static getTemplate(name: string): TemplateProcessor | undefined {
    return this.templates.get(name);
  }

  static getAllTemplates(): TemplateProcessor[] {
    return Array.from(this.templates.values());
  }

  static getTemplateNames(): string[] {
    return Array.from(this.templates.keys());
  }

  static hasTemplate(name: string): boolean {
    return this.templates.has(name);
  }
}
