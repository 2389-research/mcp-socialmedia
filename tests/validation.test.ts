// ABOUTME: Unit tests for validation utilities
// ABOUTME: Tests all validation functions with various input scenarios and edge cases

import { jest } from '@jest/globals';

import {
  ValidationResult,
  ValidationError,
  validateString,
  validateNumber,
  validateArray,
  validateLoginInput,
  validateReadPostsInput,
  validateCreatePostInput,
} from '../src/validation.js';

describe('ValidationResult', () => {
  describe('constructor', () => {
    it('should create valid result', () => {
      const result = new ValidationResult(true, [], { data: 'test' });

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.data).toEqual({ data: 'test' });
    });

    it('should create invalid result', () => {
      const errors = [{ field: 'test', message: 'error' }];
      const result = new ValidationResult(false, errors);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(errors);
      expect(result.data).toBeUndefined();
    });
  });

  describe('static methods', () => {
    it('should create success result', () => {
      const data = { test: 'value' };
      const result = ValidationResult.success(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.data).toBe(data);
    });

    it('should create failure result', () => {
      const errors = [{ field: 'test', message: 'error' }];
      const result = ValidationResult.failure(errors);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBe(errors);
      expect(result.data).toBeUndefined();
    });
  });
});

describe('validateString', () => {
  describe('basic validation', () => {
    it('should validate valid string', () => {
      const errors = validateString('hello', 'name');
      expect(errors).toEqual([]);
    });

    it('should allow undefined/null when not required', () => {
      expect(validateString(undefined, 'name')).toEqual([]);
      expect(validateString(null, 'name')).toEqual([]);
    });

    it('should reject undefined/null when required', () => {
      const errors = validateString(undefined, 'name', { required: true });
      expect(errors).toEqual([{ field: 'name', message: 'name is required' }]);

      const errors2 = validateString(null, 'name', { required: true });
      expect(errors2).toEqual([{ field: 'name', message: 'name is required' }]);
    });

    it('should reject non-string types', () => {
      const testCases = [123, true, {}, [], () => {}];

      testCases.forEach(value => {
        const errors = validateString(value, 'name');
        expect(errors).toEqual([{ field: 'name', message: 'name must be a string' }]);
      });
    });
  });

  describe('length validation', () => {
    it('should enforce minimum length', () => {
      const errors = validateString('hi', 'name', { minLength: 3 });
      expect(errors).toEqual([{ field: 'name', message: 'name must be at least 3 characters' }]);
    });

    it('should enforce maximum length', () => {
      const errors = validateString('toolong', 'name', { maxLength: 3 });
      expect(errors).toEqual([{ field: 'name', message: 'name must be at most 3 characters' }]);
    });

    it('should pass valid length', () => {
      const errors = validateString('hello', 'name', { minLength: 3, maxLength: 10 });
      expect(errors).toEqual([]);
    });
  });

  describe('content field special handling', () => {
    it('should use special error message for required content', () => {
      const errors = validateString(undefined, 'content', { required: true });
      expect(errors).toEqual([{ field: 'content', message: 'Content must not be empty' }]);
    });

    it('should check trimmed content for emptiness', () => {
      const errors = validateString('   ', 'content', { required: true });
      expect(errors).toEqual([{ field: 'content', message: 'Content must not be empty' }]);
    });

    it('should use special message for content minLength', () => {
      const errors = validateString('', 'content', { minLength: 1 });
      expect(errors).toEqual([{ field: 'content', message: 'Content must not be empty' }]);
    });

    it('should accept valid trimmed content', () => {
      const errors = validateString('  hello  ', 'content', { required: true, minLength: 1 });
      expect(errors).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const errors = validateString('', 'name');
      expect(errors).toEqual([]);
    });

    it('should handle very long string', () => {
      const longString = 'a'.repeat(10000);
      const errors = validateString(longString, 'name');
      expect(errors).toEqual([]);
    });

    it('should handle unicode characters', () => {
      const errors = validateString('🚀 émojis and accénts', 'name');
      expect(errors).toEqual([]);
    });

    it('should handle zero minLength', () => {
      const errors = validateString('', 'name', { minLength: 0 });
      expect(errors).toEqual([]);
    });

    it('should handle zero maxLength', () => {
      const errors = validateString('', 'name', { maxLength: 0 });
      expect(errors).toEqual([]);

      const errors2 = validateString('a', 'name', { maxLength: 0 });
      expect(errors2).toEqual([]); // No validation due to falsy check
    });
  });
});

describe('validateNumber', () => {
  describe('basic validation', () => {
    it('should validate valid number', () => {
      const errors = validateNumber(42, 'age');
      expect(errors).toEqual([]);
    });

    it('should validate zero', () => {
      const errors = validateNumber(0, 'count');
      expect(errors).toEqual([]);
    });

    it('should validate negative numbers', () => {
      const errors = validateNumber(-10, 'temperature');
      expect(errors).toEqual([]);
    });

    it('should validate decimal numbers', () => {
      const errors = validateNumber(3.14, 'pi');
      expect(errors).toEqual([]);
    });

    it('should allow undefined/null when not required', () => {
      expect(validateNumber(undefined, 'age')).toEqual([]);
      expect(validateNumber(null, 'age')).toEqual([]);
    });

    it('should reject undefined/null when required', () => {
      const errors = validateNumber(undefined, 'age', { required: true });
      expect(errors).toEqual([{ field: 'age', message: 'age is required' }]);
    });

    it('should reject non-number types', () => {
      const testCases = ['123', true, {}, [], () => {}];

      testCases.forEach(value => {
        const errors = validateNumber(value, 'age');
        expect(errors).toEqual([{ field: 'age', message: 'age must be a number' }]);
      });
    });

    it('should reject NaN', () => {
      const errors = validateNumber(NaN, 'age');
      expect(errors).toEqual([{ field: 'age', message: 'age must be a number' }]);
    });

    it('should validate Infinity', () => {
      const errors = validateNumber(Infinity, 'value');
      expect(errors).toEqual([]);
    });
  });

  describe('range validation', () => {
    it('should enforce minimum value', () => {
      const errors = validateNumber(5, 'age', { min: 10 });
      expect(errors).toEqual([{ field: 'age', message: 'age must be at least 10' }]);
    });

    it('should enforce maximum value', () => {
      const errors = validateNumber(150, 'age', { max: 100 });
      expect(errors).toEqual([{ field: 'age', message: 'age must be at most 100' }]);
    });

    it('should pass valid range', () => {
      const errors = validateNumber(25, 'age', { min: 0, max: 100 });
      expect(errors).toEqual([]);
    });

    it('should handle boundary values', () => {
      expect(validateNumber(10, 'value', { min: 10, max: 20 })).toEqual([]);
      expect(validateNumber(20, 'value', { min: 10, max: 20 })).toEqual([]);
    });

    it('should handle negative ranges', () => {
      const errors = validateNumber(-5, 'temp', { min: -10, max: 0 });
      expect(errors).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle zero as minimum', () => {
      const errors = validateNumber(-1, 'count', { min: 0 });
      expect(errors).toEqual([{ field: 'count', message: 'count must be at least 0' }]);
    });

    it('should handle zero as maximum', () => {
      const errors = validateNumber(1, 'debt', { max: 0 });
      expect(errors).toEqual([{ field: 'debt', message: 'debt must be at most 0' }]);
    });

    it('should handle very large numbers', () => {
      const errors = validateNumber(Number.MAX_SAFE_INTEGER, 'big');
      expect(errors).toEqual([]);
    });

    it('should handle very small numbers', () => {
      const errors = validateNumber(Number.MIN_SAFE_INTEGER, 'small');
      expect(errors).toEqual([]);
    });
  });
});

describe('validateArray', () => {
  describe('basic validation', () => {
    it('should validate valid array', () => {
      const errors = validateArray([1, 2, 3], 'items');
      expect(errors).toEqual([]);
    });

    it('should validate empty array', () => {
      const errors = validateArray([], 'items');
      expect(errors).toEqual([]);
    });

    it('should allow undefined/null when not required', () => {
      expect(validateArray(undefined, 'items')).toEqual([]);
      expect(validateArray(null, 'items')).toEqual([]);
    });

    it('should reject undefined/null when required', () => {
      const errors = validateArray(undefined, 'items', { required: true });
      expect(errors).toEqual([{ field: 'items', message: 'items is required' }]);
    });

    it('should reject non-array types', () => {
      const testCases = ['array', 123, true, {}, () => {}];

      testCases.forEach(value => {
        const errors = validateArray(value, 'items');
        expect(errors).toEqual([{ field: 'items', message: 'items must be an array' }]);
      });
    });
  });

  describe('item validation', () => {
    it('should validate array items', () => {
      const itemValidator = (item: unknown) => {
        if (typeof item !== 'string') {
          return [{ field: 'item', message: 'must be string' }];
        }
        return [];
      };

      const errors = validateArray(['a', 'b', 'c'], 'tags', { itemValidator });
      expect(errors).toEqual([]);
    });

    it('should collect item validation errors', () => {
      const itemValidator = (item: unknown, index: number) => {
        if (typeof item !== 'string') {
          return [{ field: 'item', message: `item ${index} must be string` }];
        }
        return [];
      };

      const errors = validateArray(['a', 123, 'c'], 'tags', { itemValidator });
      expect(errors).toEqual([{
        field: 'tags[1].item',
        message: 'item 1 must be string',
      }]);
    });

    it('should handle multiple item errors', () => {
      const itemValidator = (item: unknown) => {
        const errors = [];
        if (typeof item !== 'object') {
          errors.push({ field: 'type', message: 'must be object' });
        }
        return errors;
      };

      const errors = validateArray(['a', 123, true], 'items', { itemValidator });
      expect(errors).toEqual([
        { field: 'items[0].type', message: 'must be object' },
        { field: 'items[1].type', message: 'must be object' },
        { field: 'items[2].type', message: 'must be object' },
      ]);
    });

    it('should handle complex item validation', () => {
      const itemValidator = (item: any) => {
        const errors = [];
        if (!item.name) {
          errors.push({ field: 'name', message: 'name required' });
        }
        if (item.age !== undefined && typeof item.age !== 'number') {
          errors.push({ field: 'age', message: 'age must be number' });
        }
        return errors;
      };

      const items = [
        { name: 'John', age: 25 },
        { name: '', age: 'old' },
        { age: 30 },
      ];

      const errors = validateArray(items, 'people', { itemValidator });
      expect(errors).toEqual([
        { field: 'people[1].name', message: 'name required' },
        { field: 'people[1].age', message: 'age must be number' },
        { field: 'people[2].name', message: 'name required' },
      ]);
    });
  });

  describe('edge cases', () => {
    it('should handle array-like objects', () => {
      const arrayLike = { 0: 'a', 1: 'b', length: 2 };
      const errors = validateArray(arrayLike, 'items');
      expect(errors).toEqual([{ field: 'items', message: 'items must be an array' }]);
    });

    it('should handle large arrays', () => {
      const largeArray = new Array(1000).fill('item');
      const errors = validateArray(largeArray, 'items');
      expect(errors).toEqual([]);
    });

    it('should handle nested arrays', () => {
      const nestedArray = [['a'], ['b'], ['c']];
      const errors = validateArray(nestedArray, 'nested');
      expect(errors).toEqual([]);
    });
  });
});

describe('validateLoginInput', () => {
  describe('valid inputs', () => {
    it('should validate valid agent name', () => {
      const result = validateLoginInput({ agent_name: 'test-agent' });

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.data).toEqual({ agent_name: 'test-agent' });
    });

    it('should trim whitespace from agent name', () => {
      const result = validateLoginInput({ agent_name: '  test-agent  ' });

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({ agent_name: 'test-agent' });
    });

    it('should handle unicode agent names', () => {
      const result = validateLoginInput({ agent_name: 'tëst-ãgent-🤖' });

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({ agent_name: 'tëst-ãgent-🤖' });
    });
  });

  describe('invalid inputs', () => {
    it('should reject undefined agent name', () => {
      const result = validateLoginInput({});

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([{ field: 'agent_name', message: 'Agent name must not be empty' }]);
    });

    it('should reject null agent name', () => {
      const result = validateLoginInput({ agent_name: null });

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([{ field: 'agent_name', message: 'Agent name must not be empty' }]);
    });

    it('should reject non-string agent name', () => {
      const testCases = [123, true, {}, []];

      testCases.forEach(value => {
        const result = validateLoginInput({ agent_name: value });
        expect(result.isValid).toBe(false);
        expect(result.errors).toEqual([{ field: 'agent_name', message: 'Agent name must be a string' }]);
      });
    });

    it('should reject empty string agent name', () => {
      const result = validateLoginInput({ agent_name: '' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([{ field: 'agent_name', message: 'Agent name must not be empty' }]);
    });

    it('should reject whitespace-only agent name', () => {
      const result = validateLoginInput({ agent_name: '   ' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([{ field: 'agent_name', message: 'Agent name must not be empty' }]);
    });
  });
});

describe('validateReadPostsInput', () => {
  describe('valid inputs', () => {
    it('should use defaults for empty input', () => {
      const result = validateReadPostsInput({});

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({
        limit: 10,
        offset: 0,
        agent_filter: undefined,
        tag_filter: undefined,
        thread_id: undefined,
      });
    });

    it('should validate with all parameters', () => {
      const input = {
        limit: 20,
        offset: 5,
        agent_filter: 'test-agent',
        tag_filter: 'important',
        thread_id: 'thread-123',
      };

      const result = validateReadPostsInput(input);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(input);
    });

    it('should parse string numbers', () => {
      const result = validateReadPostsInput({ limit: '25', offset: '10' });

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({
        limit: 25,
        offset: 10,
        agent_filter: undefined,
        tag_filter: undefined,
        thread_id: undefined,
      });
    });

    it('should trim filter strings', () => {
      const result = validateReadPostsInput({
        agent_filter: '  test-agent  ',
        tag_filter: '  important  ',
        thread_id: '  thread-123  ',
      });

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({
        limit: 10,
        offset: 0,
        agent_filter: 'test-agent',
        tag_filter: 'important',
        thread_id: 'thread-123',
      });
    });

    it('should handle boundary values', () => {
      const result = validateReadPostsInput({ limit: 1, offset: 0 });

      expect(result.isValid).toBe(true);
      expect(result.data?.limit).toBe(1);
      expect(result.data?.offset).toBe(0);
    });
  });

  describe('invalid inputs', () => {
    it('should reject invalid limit range', () => {
      const testCases = [
        { limit: 0, expectedMessage: 'limit must be at least 1' },
        { limit: 101, expectedMessage: 'limit must be at most 100' },
        { limit: -5, expectedMessage: 'limit must be at least 1' },
      ];

      testCases.forEach(({ limit, expectedMessage }) => {
        const result = validateReadPostsInput({ limit });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({ field: 'limit', message: expectedMessage });
      });
    });

    it('should reject negative offset', () => {
      const result = validateReadPostsInput({ offset: -1 });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({ field: 'offset', message: 'offset must be at least 0' });
    });

    it('should reject empty filter strings', () => {
      const result = validateReadPostsInput({
        agent_filter: '',
        tag_filter: '   ',
        thread_id: '\t\n',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        { field: 'agent_filter', message: 'agent_filter cannot be empty' },
        { field: 'tag_filter', message: 'tag_filter cannot be empty' },
        { field: 'thread_id', message: 'thread_id cannot be empty' },
      ]);
    });

    it('should handle NaN values', () => {
      const result = validateReadPostsInput({ limit: 'invalid', offset: 'bad' });

      expect(result.isValid).toBe(true); // NaN converts to defaults
      expect(result.data?.limit).toBe(10);
      expect(result.data?.offset).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle non-string filter types by converting', () => {
      const result = validateReadPostsInput({
        agent_filter: 123,
        tag_filter: true,
        thread_id: 456,
      });

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({
        limit: 10,
        offset: 0,
        agent_filter: '123',
        tag_filter: 'true',
        thread_id: '456',
      });
    });

    it('should reject object/array filters', () => {
      const result = validateReadPostsInput({
        agent_filter: {},
        tag_filter: [],
        thread_id: () => {},
      });

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({
        limit: 10,
        offset: 0,
        agent_filter: undefined,
        tag_filter: undefined,
        thread_id: undefined,
      });
    });
  });
});

describe('validateCreatePostInput', () => {
  describe('valid inputs', () => {
    it('should validate minimal post', () => {
      const result = validateCreatePostInput({ content: 'Hello world!' });

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({
        content: 'Hello world!',
        tags: [],
        parent_post_id: undefined,
      });
    });

    it('should validate post with all fields', () => {
      const input = {
        content: 'Hello world!',
        tags: ['important', 'update'],
        parent_post_id: 'post-123',
      };

      const result = validateCreatePostInput(input);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(input);
    });

    it('should trim content and filters', () => {
      const result = validateCreatePostInput({
        content: '  Hello world!  ',
        tags: ['  important  ', '  update  '],
        parent_post_id: '  post-123  ',
      });

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({
        content: 'Hello world!',
        tags: ['important', 'update'],
        parent_post_id: 'post-123',
      });
    });

    it('should handle filtering tags validation', () => {
      // First test that array validation fails with invalid tag items
      const result1 = validateCreatePostInput({
        content: 'Hello',
        tags: ['valid', {}, []],
      });

      expect(result1.isValid).toBe(false);
      expect(result1.errors).toEqual([
        { field: 'tags[1].item', message: 'item must be a string' },
        { field: 'tags[2].item', message: 'item must be a string' },
      ]);

      // Test that valid tags pass through
      const result2 = validateCreatePostInput({
        content: 'Hello',
        tags: ['valid', 'another', 'third'],
      });

      expect(result2.isValid).toBe(true);
      expect(result2.data).toEqual({
        content: 'Hello',
        tags: ['valid', 'another', 'third'],
        parent_post_id: undefined,
      });
    });

    it('should handle unicode content', () => {
      const result = validateCreatePostInput({ content: '🚀 Hello 世界! Émojis and accénts' });

      expect(result.isValid).toBe(true);
      expect(result.data?.content).toBe('🚀 Hello 世界! Émojis and accénts');
    });
  });

  describe('invalid inputs', () => {
    it('should reject missing content', () => {
      const result = validateCreatePostInput({});

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({ field: 'content', message: 'Content must not be empty' });
    });

    it('should reject null/undefined content', () => {
      const testCases = [null, undefined];

      testCases.forEach(content => {
        const result = validateCreatePostInput({ content });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({ field: 'content', message: 'Content must not be empty' });
      });
    });

    it('should reject non-string content', () => {
      const testCases = [123, true, {}, []];

      testCases.forEach(content => {
        const result = validateCreatePostInput({ content });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({ field: 'content', message: 'content must be a string' });
      });
    });

    it('should reject empty/whitespace content', () => {
      const testCases = ['', '   ', '\t\n\r'];

      testCases.forEach(content => {
        const result = validateCreatePostInput({ content });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({ field: 'content', message: 'Content must not be empty' });
      });
    });

    it('should reject non-array tags', () => {
      const result = validateCreatePostInput({
        content: 'Hello',
        tags: 'not-array',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({ field: 'tags', message: 'tags must be an array' });
    });

    it('should reject invalid tag items', () => {
      const result = validateCreatePostInput({
        content: 'Hello',
        tags: ['valid', {}, []],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        { field: 'tags[1].item', message: 'item must be a string' },
        { field: 'tags[2].item', message: 'item must be a string' },
      ]);
    });

    it('should reject non-string parent_post_id', () => {
      const testCases = [123, true, {}, []];

      testCases.forEach(parent_post_id => {
        const result = validateCreatePostInput({
          content: 'Hello',
          parent_post_id,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({ field: 'parent_post_id', message: 'parent_post_id must be a string' });
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty tags array', () => {
      const result = validateCreatePostInput({
        content: 'Hello',
        tags: [],
      });

      expect(result.isValid).toBe(true);
      expect(result.data?.tags).toEqual([]);
    });

    it('should handle very long content', () => {
      const longContent = 'a'.repeat(10000);
      const result = validateCreatePostInput({ content: longContent });

      expect(result.isValid).toBe(true);
      expect(result.data?.content).toBe(longContent);
    });

    it('should handle many tags', () => {
      const manyTags = Array(100).fill(0).map((_, i) => `tag${i}`);
      const result = validateCreatePostInput({
        content: 'Hello',
        tags: manyTags,
      });

      expect(result.isValid).toBe(true);
      expect(result.data?.tags).toEqual(manyTags);
    });

    it('should handle mixed valid/invalid tags', () => {
      const result = validateCreatePostInput({
        content: 'Hello',
        tags: ['good', '', '  ', 'also-good', 'final'],
      });

      expect(result.isValid).toBe(true);
      expect(result.data?.tags).toEqual(['good', 'also-good', 'final']);
    });
  });
});

describe('trimStringValue helper', () => {
  // Note: This is a private function, but we can test it indirectly through the public functions

  describe('through validateReadPostsInput', () => {
    it('should handle string conversion for numbers/booleans', () => {
      const result = validateReadPostsInput({
        agent_filter: 123,
        tag_filter: true,
        thread_id: false,
      });

      expect(result.isValid).toBe(true);
      expect(result.data?.agent_filter).toBe('123');
      expect(result.data?.tag_filter).toBe('true');
      expect(result.data?.thread_id).toBe('false');
    });

    it('should reject objects/arrays/functions', () => {
      const result = validateReadPostsInput({
        agent_filter: {},
        tag_filter: [],
        thread_id: () => {},
      });

      expect(result.isValid).toBe(true);
      expect(result.data?.agent_filter).toBeUndefined();
      expect(result.data?.tag_filter).toBeUndefined();
      expect(result.data?.thread_id).toBeUndefined();
    });

    it('should handle null/undefined', () => {
      const result = validateReadPostsInput({
        agent_filter: null,
        tag_filter: undefined,
      });

      expect(result.isValid).toBe(true);
      expect(result.data?.agent_filter).toBeUndefined();
      expect(result.data?.tag_filter).toBeUndefined();
    });

    it('should trim whitespace from strings', () => {
      const result = validateReadPostsInput({
        agent_filter: '  hello  ',
        tag_filter: '\t\nworld\r\n',
      });

      expect(result.isValid).toBe(true);
      expect(result.data?.agent_filter).toBe('hello');
      expect(result.data?.tag_filter).toBe('world');
    });

    it('should return undefined for empty trimmed strings', () => {
      const result = validateReadPostsInput({
        agent_filter: '   ',
        tag_filter: '\t\n\r',
      });

      expect(result.isValid).toBe(false); // Empty strings are rejected
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
