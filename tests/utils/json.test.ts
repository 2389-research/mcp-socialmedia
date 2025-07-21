// ABOUTME: Tests for safe JSON utilities in src/utils/json.ts
// ABOUTME: Validates safe stringify, parse, and validation functions with edge cases

import { jest } from '@jest/globals';
import { isValidJson, safeJsonParse, safeJsonStringify } from '../../src/utils/json.js';

describe('JSON Utilities', () => {
  describe('safeJsonStringify', () => {
    test('should stringify normal objects correctly', () => {
      const obj = { name: 'test', value: 42, active: true };
      const result = safeJsonStringify(obj);
      expect(result).toBe('{"name":"test","value":42,"active":true}');
    });

    test('should stringify arrays correctly', () => {
      const arr = [1, 'two', { three: 3 }, null];
      const result = safeJsonStringify(arr);
      expect(result).toBe('[1,"two",{"three":3},null]');
    });

    test('should stringify primitives correctly', () => {
      expect(safeJsonStringify(42)).toBe('42');
      expect(safeJsonStringify('hello')).toBe('"hello"');
      expect(safeJsonStringify(true)).toBe('true');
      expect(safeJsonStringify(null)).toBe('null');
    });

    test('should handle undefined values', () => {
      expect(safeJsonStringify(undefined)).toBe(undefined);
    });

    test('should handle circular references gracefully', () => {
      const obj: Record<string, unknown> = { name: 'test' };
      obj.self = obj; // Create circular reference

      const result = safeJsonStringify(obj);
      const parsed = JSON.parse(result);

      expect(parsed._error).toBe('JSON_SERIALIZATION_ERROR');
      expect(parsed._originalError).toContain('circular');
      expect(parsed._fallback).toBe('[object Object]');
    });

    test('should use custom replacer function when provided', () => {
      const obj = { password: 'secret', username: 'admin' };
      const replacer = (key: string, value: unknown) => {
        if (key === 'password') return '[REDACTED]';
        return value;
      };

      const result = safeJsonStringify(obj, replacer);
      expect(result).toBe('{"password":"[REDACTED]","username":"admin"}');
    });

    test('should handle BigInt values that cannot be serialized', () => {
      const objWithBigInt = {
        id: BigInt(9007199254740991),
        name: 'test',
      };

      const result = safeJsonStringify(objWithBigInt);
      const parsed = JSON.parse(result);

      expect(parsed._error).toBe('JSON_SERIALIZATION_ERROR');
      expect(parsed._originalError).toContain('BigInt');
    });

    test('should handle functions that cannot be serialized', () => {
      const objWithFunction = {
        name: 'test',
        handler: () => 'test',
      };

      // Functions are normally ignored by JSON.stringify, but we test custom cases
      const result = safeJsonStringify(objWithFunction);
      expect(result).toBe('{"name":"test"}'); // Function is ignored
    });

    test('should handle date objects correctly', () => {
      const date = new Date('2023-01-01T00:00:00.000Z');
      const obj = { timestamp: date, name: 'test' };

      const result = safeJsonStringify(obj);
      expect(result).toBe('{"timestamp":"2023-01-01T00:00:00.000Z","name":"test"}');
    });

    test('should handle nested objects with potential issues', () => {
      const complexObj = {
        level1: {
          level2: {
            level3: {
              data: 'deep',
            },
          },
        },
      };

      const result = safeJsonStringify(complexObj);
      expect(JSON.parse(result)).toEqual(complexObj);
    });

    test('should provide fallback for extreme edge cases', () => {
      // Mock JSON.stringify to always fail
      const originalStringify = JSON.stringify;
      JSON.stringify = jest.fn(() => {
        throw new Error('Mock error');
      });

      try {
        const result = safeJsonStringify({ test: 'value' });

        // When both JSON.stringify calls fail, it goes to last resort fallback
        const parsed = JSON.parse(result);
        expect(parsed._error).toBe('JSON_SERIALIZATION_FAILED');
        expect(parsed._type).toBe('object');
      } finally {
        // Restore original JSON.stringify
        JSON.stringify = originalStringify;
      }
    });

    test('should provide last resort fallback when everything fails', () => {
      // Mock JSON.stringify to always fail for both attempts
      const originalStringify = JSON.stringify;
      let callCount = 0;
      JSON.stringify = jest.fn(() => {
        callCount++;
        throw new Error('Mock error');
      });

      try {
        const testObj = { test: 'value' };
        const result = safeJsonStringify(testObj);

        // Should use the last resort fallback
        expect(result).toBe('{"_error":"JSON_SERIALIZATION_FAILED","_type":"object"}');
        expect(callCount).toBe(2); // Called twice - once for main, once for fallback
      } finally {
        // Restore original JSON.stringify
        JSON.stringify = originalStringify;
      }
    });
  });

  describe('safeJsonParse', () => {
    test('should parse valid JSON strings correctly', () => {
      const jsonString = '{"name":"test","value":42}';
      const defaultValue = { error: 'default' };

      const result = safeJsonParse(jsonString, defaultValue);
      expect(result).toEqual({ name: 'test', value: 42 });
    });

    test('should parse JSON arrays correctly', () => {
      const jsonString = '[1, 2, 3, "test"]';
      const defaultValue: unknown[] = [];

      const result = safeJsonParse(jsonString, defaultValue);
      expect(result).toEqual([1, 2, 3, 'test']);
    });

    test('should parse primitive JSON values', () => {
      expect(safeJsonParse('42', 0)).toBe(42);
      expect(safeJsonParse('"hello"', '')).toBe('hello');
      expect(safeJsonParse('true', false)).toBe(true);
      expect(safeJsonParse('null', 'default')).toBe(null);
    });

    test('should return default value for invalid JSON', () => {
      const invalidJson = '{"invalid": json}';
      const defaultValue = { error: 'parsing failed' };

      const result = safeJsonParse(invalidJson, defaultValue);
      expect(result).toEqual(defaultValue);
    });

    test('should return default value for malformed JSON', () => {
      const malformedJson = '{"name": "test", "value":}';
      const defaultValue = null;

      const result = safeJsonParse(malformedJson, defaultValue);
      expect(result).toBe(null);
    });

    test('should return default value for empty string', () => {
      const defaultValue = { empty: true };

      const result = safeJsonParse('', defaultValue);
      expect(result).toEqual(defaultValue);
    });

    test('should return default value for non-JSON strings', () => {
      const defaultValue = 'fallback';

      expect(safeJsonParse('not json at all', defaultValue)).toBe(defaultValue);
      expect(safeJsonParse('123abc', defaultValue)).toBe(defaultValue);
      expect(safeJsonParse('undefined', defaultValue)).toBe(defaultValue);
    });

    test('should handle different default value types', () => {
      // String default
      expect(safeJsonParse('invalid', 'default')).toBe('default');

      // Number default
      expect(safeJsonParse('invalid', 0)).toBe(0);

      // Boolean default
      expect(safeJsonParse('invalid', true)).toBe(true);

      // Array default
      expect(safeJsonParse('invalid', [])).toEqual([]);

      // Object default
      expect(safeJsonParse('invalid', { key: 'value' })).toEqual({ key: 'value' });

      // Null default
      expect(safeJsonParse('invalid', null)).toBe(null);

      // Undefined default
      expect(safeJsonParse('invalid', undefined)).toBe(undefined);
    });
  });

  describe('isValidJson', () => {
    test('should return true for valid JSON strings', () => {
      expect(isValidJson('{"name":"test","value":42}')).toBe(true);
      expect(isValidJson('[1,2,3]')).toBe(true);
      expect(isValidJson('"hello world"')).toBe(true);
      expect(isValidJson('42')).toBe(true);
      expect(isValidJson('true')).toBe(true);
      expect(isValidJson('false')).toBe(true);
      expect(isValidJson('null')).toBe(true);
    });

    test('should return true for nested valid JSON', () => {
      const nestedJson = JSON.stringify({
        level1: {
          level2: {
            array: [1, 2, { nested: true }],
            date: new Date().toISOString(),
          },
        },
      });

      expect(isValidJson(nestedJson)).toBe(true);
    });

    test('should return false for invalid JSON strings', () => {
      expect(isValidJson('{"invalid": json}')).toBe(false);
      expect(isValidJson('{"name": "test", "value":}')).toBe(false);
      expect(isValidJson('[1, 2, 3')).toBe(false);
      expect(isValidJson('{"unclosed": "object"')).toBe(false);
    });

    test('should return false for non-JSON strings', () => {
      expect(isValidJson('hello world')).toBe(false);
      expect(isValidJson('123abc')).toBe(false);
      expect(isValidJson('undefined')).toBe(false);
      expect(isValidJson('function() {}')).toBe(false);
    });

    test('should return false for empty string', () => {
      expect(isValidJson('')).toBe(false);
    });

    test('should return false for whitespace only', () => {
      expect(isValidJson('   ')).toBe(false);
      expect(isValidJson('\n\t')).toBe(false);
    });

    test('should return true for JSON with valid whitespace', () => {
      expect(isValidJson('  {"valid": true}  ')).toBe(true);
      expect(isValidJson('{\n  "multiline": true\n}')).toBe(true);
    });

    test('should handle special characters in JSON', () => {
      const jsonWithSpecial = JSON.stringify({
        emoji: '🚀',
        unicode: 'café',
        quotes: 'He said "hello"',
        backslash: 'path\\to\\file',
      });

      expect(isValidJson(jsonWithSpecial)).toBe(true);
    });

    test('should return false for JSON-like but invalid syntax', () => {
      expect(isValidJson('{name: "test"}')).toBe(false); // Unquoted property name
      expect(isValidJson("{'name': 'test'}")).toBe(false); // Single quotes
      expect(isValidJson('{"name": "test",}')).toBe(false); // Trailing comma
    });
  });

  describe('Integration Tests', () => {
    test('should work together for round-trip with valid data', () => {
      const originalData = {
        string: 'test',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        nested: { key: 'value' },
        nullValue: null,
      };

      const jsonString = safeJsonStringify(originalData);
      expect(isValidJson(jsonString)).toBe(true);

      const parsedData = safeJsonParse(jsonString, {});
      expect(parsedData).toEqual(originalData);
    });

    test('should handle problematic data gracefully', () => {
      const problematicData: Record<string, unknown> = { name: 'test' };
      problematicData.circular = problematicData;

      const jsonString = safeJsonStringify(problematicData);
      expect(isValidJson(jsonString)).toBe(true);

      const parsedData = safeJsonParse(jsonString, {});
      expect(parsedData._error).toBe('JSON_SERIALIZATION_ERROR');
    });

    test('should provide consistent behavior across functions', () => {
      const testCases = [
        '{"valid": "json"}',
        'invalid json',
        '[1,2,3]',
        '{"incomplete":',
        'null',
        '42',
      ];

      for (const testCase of testCases) {
        const isValid = isValidJson(testCase);
        const parsed = safeJsonParse(testCase, { error: 'default' });

        if (isValid) {
          expect(parsed).not.toEqual({ error: 'default' });
        } else {
          expect(parsed).toEqual({ error: 'default' });
        }
      }
    });
  });
});
