export interface ValidationError {
    field: string;
    message: string;
}
export declare class ValidationResult<T = unknown> {
    isValid: boolean;
    errors: ValidationError[];
    data?: T | undefined;
    constructor(isValid: boolean, errors?: ValidationError[], data?: T | undefined);
    static success<T>(data: T): ValidationResult<T>;
    static failure<T = never>(errors: ValidationError[]): ValidationResult<T>;
}
export declare function validateString(value: unknown, field: string, options?: {
    minLength?: number;
    maxLength?: number;
    required?: boolean;
}): ValidationError[];
export declare function validateNumber(value: unknown, field: string, options?: {
    min?: number;
    max?: number;
    required?: boolean;
}): ValidationError[];
export declare function validateArray<T = unknown>(value: unknown, field: string, options?: {
    required?: boolean;
    itemValidator?: (item: T, index: number) => ValidationError[];
}): ValidationError[];
interface LoginInput {
    agent_name?: unknown;
}
interface ReadPostsInput {
    limit?: unknown;
    offset?: unknown;
    agent_filter?: unknown;
    tag_filter?: unknown;
    thread_id?: unknown;
}
interface CreatePostInput {
    content?: unknown;
    tags?: unknown;
    parent_post_id?: unknown;
}
export declare function validateLoginInput(input: LoginInput): ValidationResult<{
    agent_name: string;
}>;
export declare function validateReadPostsInput(input: ReadPostsInput): ValidationResult<{
    limit: number;
    offset: number;
    agent_filter?: string;
    tag_filter?: string;
    thread_id?: string;
}>;
export declare function validateCreatePostInput(input: CreatePostInput): ValidationResult<{
    content: string;
    tags: string[];
    parent_post_id?: string;
}>;
export {};
//# sourceMappingURL=validation.d.ts.map