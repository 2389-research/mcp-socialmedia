// ABOUTME: Safe JSON utilities to prevent malformed JSON in MCP responses
// ABOUTME: Handles circular references and serialization errors gracefully
/**
 * Safely stringify an object to JSON, handling circular references and errors
 */
export function safeJsonStringify(obj, replacer) {
    try {
        return JSON.stringify(obj, replacer);
    }
    catch (error) {
        // Handle circular references or other serialization errors
        try {
            return JSON.stringify({
                _error: 'JSON_SERIALIZATION_ERROR',
                _originalError: error instanceof Error ? error.message : String(error),
                _fallback: String(obj),
            });
        }
        catch {
            // Last resort - return a simple error object
            return '{"_error":"JSON_SERIALIZATION_FAILED","_type":"' + typeof obj + '"}';
        }
    }
}
/**
 * Safely parse JSON, returning a default value on error
 */
export function safeJsonParse(jsonString, defaultValue) {
    try {
        return JSON.parse(jsonString);
    }
    catch {
        return defaultValue;
    }
}
/**
 * Validate that a string is valid JSON
 */
export function isValidJson(str) {
    try {
        JSON.parse(str);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=json.js.map