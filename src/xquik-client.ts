// ABOUTME: Read-only client for X post search through the Xquik API
// ABOUTME: Keeps Xquik credentials isolated from team social API credentials

import fetch, { type RequestInit } from 'node-fetch';

const DEFAULT_BASE_URL = 'https://xquik.com/api/v1';
const DEFAULT_TIMEOUT_MS = 15000;

/** Fetch implementation accepted for production use and deterministic tests. */
export type XquikFetchFunction = typeof fetch;

/** Define the bounded query sent to the Xquik search endpoint. */
export interface XquikSearchOptions {
  query: string;
  limit: number;
}

/** Expose the read-only operation required by the MCP tool. */
export interface IXquikClient {
  searchPosts(options: XquikSearchOptions): Promise<unknown>;
}

/** Search public X posts through an authenticated Xquik endpoint. */
export class XquikClient implements IXquikClient {
  private readonly baseUrl: string;

  /** Create a client with overridable transport settings for deterministic tests. */
  constructor(
    private readonly apiKey: string,
    baseUrl: string = DEFAULT_BASE_URL,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
    private readonly fetchFn: XquikFetchFunction = fetch,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /** Search public X posts through the configured Xquik endpoint. */
  async searchPosts(options: XquikSearchOptions): Promise<unknown> {
    const params = new URLSearchParams({
      q: options.query,
      limit: options.limit.toString(),
    });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const request: RequestInit = {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-api-key': this.apiKey,
      },
      signal: controller.signal,
    };

    try {
      const response = await this.fetchFn(`${this.baseUrl}/x/tweets/search?${params}`, request);

      if (!response.ok) {
        throw new Error(`Xquik request failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Xquik request timed out after ${this.timeoutMs}ms`);
      }
      if (error instanceof Error && error.message.startsWith('Xquik request failed with status')) {
        throw error;
      }
      throw new Error('Xquik request failed');
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/** Create the optional Xquik client when its API key is configured. */
export function createXquikClientFromEnv(): IXquikClient | undefined {
  const apiKey = process.env.XQUIK_API_KEY?.trim();
  return apiKey ? new XquikClient(apiKey) : undefined;
}
