// ABOUTME: Tests for the optional read-only X post search tool
// ABOUTME: Verifies successful results and sanitized failure responses

import { jest } from '@jest/globals';
import { searchXPostsToolHandler } from '../../src/tools/search-x-posts';
import type { IXquikClient } from '../../src/xquik-client';

describe('Search X Posts Tool', () => {
  let xquikClient: jest.Mocked<IXquikClient>;

  beforeEach(() => {
    xquikClient = {
      searchPosts: jest.fn(),
    };
  });

  it('returns Xquik search results as structured MCP content', async () => {
    const resultBody = { tweets: [{ id: 'tweet-1', text: 'Result' }] };
    xquikClient.searchPosts.mockResolvedValue(resultBody);

    const result = await searchXPostsToolHandler({ query: '#agents', limit: 3 }, { xquikClient });

    expect(xquikClient.searchPosts).toHaveBeenCalledWith({ query: '#agents', limit: 3 });
    expect(JSON.parse(result.content[0].text)).toEqual({ success: true, result: resultBody });
  });

  it('returns a stable failure shape when the request fails', async () => {
    xquikClient.searchPosts.mockRejectedValue(new Error('Xquik request failed with status 429'));

    const result = await searchXPostsToolHandler({ query: 'agents', limit: 10 }, { xquikClient });

    expect(JSON.parse(result.content[0].text)).toEqual({
      success: false,
      error: 'Failed to search X posts',
      details: 'Xquik request failed with status 429',
    });
  });
});
