// ABOUTME: Tests for the read-only Xquik API client
// ABOUTME: Verifies request construction, errors, timeouts, and environment setup

import { jest } from '@jest/globals';
import {
  XquikClient,
  type XquikFetchFunction,
  createXquikClientFromEnv,
} from '../src/xquik-client';

type MockResponse = {
  ok: boolean;
  status: number;
  json: jest.MockedFunction<() => Promise<unknown>>;
};

describe('XquikClient', () => {
  let mockFetch: jest.MockedFunction<XquikFetchFunction>;

  beforeEach(() => {
    mockFetch = jest.fn() as jest.MockedFunction<XquikFetchFunction>;
  });

  it('searches posts with bounded query parameters and API key authentication', async () => {
    const resultBody = { tweets: [{ id: 'tweet-1', text: 'Result' }] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(resultBody),
    } as MockResponse);
    const client = new XquikClient('test-key', 'https://example.com/api/v1/', 5000, mockFetch);

    const result = await client.searchPosts({ query: 'agent tools', limit: 5 });

    expect(result).toEqual(resultBody);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/v1/x/tweets/search?q=agent+tools&limit=5',
      expect.objectContaining({
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'x-api-key': 'test-key',
        },
      }),
    );
  });

  it('returns a status-only error without exposing response details', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: jest.fn(),
    } as MockResponse);
    const client = new XquikClient('invalid-key', undefined, 5000, mockFetch);

    await expect(client.searchPosts({ query: 'test', limit: 10 })).rejects.toThrow(
      'Xquik request failed with status 401',
    );
  });

  it('maps aborted requests to a bounded timeout error', async () => {
    jest.useFakeTimers();

    try {
      mockFetch.mockImplementationOnce((_url, request) => {
        return new Promise((_resolve, reject) => {
          request?.signal?.addEventListener(
            'abort',
            () => {
              const aborted = new Error('aborted');
              aborted.name = 'AbortError';
              reject(aborted);
            },
            { once: true },
          );
        });
      });
      const client = new XquikClient('test-key', undefined, 25, mockFetch);
      const search = client.searchPosts({ query: 'test', limit: 10 });
      const expectation = expect(search).rejects.toThrow('Xquik request timed out after 25ms');

      await jest.advanceTimersByTimeAsync(25);
      await expectation;
    } finally {
      jest.useRealTimers();
    }
  });

  it('creates a client only when XQUIK_API_KEY is configured', () => {
    const originalApiKey = process.env.XQUIK_API_KEY;
    process.env.XQUIK_API_KEY = '';

    try {
      expect(createXquikClientFromEnv()).toBeUndefined();

      process.env.XQUIK_API_KEY = '  test-key  ';
      expect(createXquikClientFromEnv()).toBeInstanceOf(XquikClient);
    } finally {
      if (originalApiKey === undefined) {
        Reflect.deleteProperty(process.env, 'XQUIK_API_KEY');
      } else {
        process.env.XQUIK_API_KEY = originalApiKey;
      }
    }
  });
});
