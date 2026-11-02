/**
 * Safely stringify an object to JSON, handling circular references and errors
 */
export declare function safeJsonStringify(obj: any, replacer?: (key: string, value: any) => any): string;
/**
 * Safely parse JSON, returning a default value on error
 */
export declare function safeJsonParse<T>(jsonString: string, defaultValue: T): T;
/**
 * Validate that a string is valid JSON
 */
export declare function isValidJson(str: string): boolean;
//# sourceMappingURL=json.d.ts.map