// ABOUTME: JSON Schema validation utilities for MCP tools
// ABOUTME: Provides runtime validation for tool inputs

export interface ValidationError {
  field: string;
  message: string;
}

export class ValidationResult {
  constructor(
    public isValid: boolean,
    public errors: ValidationError[] = [],
    public data?: any,
  ) {}

  static success(data: any): ValidationResult {
    return new ValidationResult(true, [], data);
  }

  static failure(errors: ValidationError[]): ValidationResult {
    return new ValidationResult(false, errors);
  }
}

export function validateString(
  value: any,
  field: string,
  options: { minLength?: number; maxLength?: number; required?: boolean } = {},
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (options.required && (value === undefined || value === null)) {
    if (field === 'content') {
      errors.push({ field, message: 'Content must not be empty' });
    } else {
      errors.push({ field, message: `${field} is required` });
    }
    return errors;
  }

  if (value !== undefined && value !== null) {
    if (typeof value !== 'string') {
      errors.push({ field, message: `${field} must be a string` });
      return errors;
    }

    // For content validation, check if trimmed string is empty
    if (field === 'content' && options.required && value.trim().length === 0) {
      errors.push({ field, message: 'Content must not be empty' });
      return errors;
    }

    if (options.minLength && value.length < options.minLength) {
      if (field === 'content') {
        errors.push({ field, message: 'Content must not be empty' });
      } else {
        errors.push({
          field,
          message: `${field} must be at least ${options.minLength} characters`,
        });
      }
    }

    if (options.maxLength && value.length > options.maxLength) {
      errors.push({ field, message: `${field} must be at most ${options.maxLength} characters` });
    }
  }

  return errors;
}

export function validateNumber(
  value: any,
  field: string,
  options: { min?: number; max?: number; required?: boolean } = {},
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (options.required && (value === undefined || value === null)) {
    errors.push({ field, message: `${field} is required` });
    return errors;
  }

  if (value !== undefined && value !== null) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      errors.push({ field, message: `${field} must be a number` });
      return errors;
    }

    if (options.min !== undefined && value < options.min) {
      errors.push({ field, message: `${field} must be at least ${options.min}` });
    }

    if (options.max !== undefined && value > options.max) {
      errors.push({ field, message: `${field} must be at most ${options.max}` });
    }
  }

  return errors;
}

export function validateArray(
  value: any,
  field: string,
  options: {
    required?: boolean;
    itemValidator?: (item: any, index: number) => ValidationError[];
  } = {},
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (options.required && (value === undefined || value === null)) {
    errors.push({ field, message: `${field} is required` });
    return errors;
  }

  if (value !== undefined && value !== null) {
    if (!Array.isArray(value)) {
      errors.push({ field, message: `${field} must be an array` });
      return errors;
    }

    if (options.itemValidator) {
      value.forEach((item, index) => {
        const itemErrors = options.itemValidator?.(item, index);
        if (itemErrors) {
          errors.push(
            ...itemErrors.map((err) => ({
              field: `${field}[${index}].${err.field}`,
              message: err.message,
            })),
          );
        }
      });
    }
  }

  return errors;
}

// Helper to trim string values consistently
function trimStringValue(value: any): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return value;
}

// Login tool validation
export function validateLoginInput(input: any): ValidationResult {
  const errors: ValidationError[] = [];

  // Special handling for agent_name
  if (input.agent_name === undefined || input.agent_name === null) {
    errors.push({ field: 'agent_name', message: 'Agent name must not be empty' });
  } else if (typeof input.agent_name !== 'string') {
    errors.push({ field: 'agent_name', message: 'Agent name must be a string' });
  } else if (input.agent_name.trim().length === 0) {
    errors.push({ field: 'agent_name', message: 'Agent name must not be empty' });
  }

  if (errors.length > 0) {
    return ValidationResult.failure(errors);
  }

  return ValidationResult.success({
    agent_name: trimStringValue(input.agent_name)!,
  });
}

// Read posts tool validation
export function validateReadPostsInput(input: any): ValidationResult {
  const errors: ValidationError[] = [];

  // Apply defaults and trim string values
  const data = {
    limit: input.limit ?? 10,
    offset: input.offset ?? 0,
    agent_filter: trimStringValue(input.agent_filter),
    tag_filter: trimStringValue(input.tag_filter),
    thread_id: trimStringValue(input.thread_id),
  };

  errors.push(...validateNumber(data.limit, 'limit', { min: 1, max: 100 }));
  errors.push(...validateNumber(data.offset, 'offset', { min: 0 }));

  // Check for empty string filters (before trimming converted them to undefined)
  if (
    input.agent_filter !== undefined &&
    input.agent_filter !== null &&
    typeof input.agent_filter === 'string' &&
    input.agent_filter.trim() === ''
  ) {
    errors.push({ field: 'agent_filter', message: 'agent_filter cannot be empty' });
  }

  if (
    input.tag_filter !== undefined &&
    input.tag_filter !== null &&
    typeof input.tag_filter === 'string' &&
    input.tag_filter.trim() === ''
  ) {
    errors.push({ field: 'tag_filter', message: 'tag_filter cannot be empty' });
  }

  if (
    input.thread_id !== undefined &&
    input.thread_id !== null &&
    typeof input.thread_id === 'string' &&
    input.thread_id.trim() === ''
  ) {
    errors.push({ field: 'thread_id', message: 'thread_id cannot be empty' });
  }

  if (errors.length > 0) {
    return ValidationResult.failure(errors);
  }

  return ValidationResult.success(data);
}

// Create post tool validation
export function validateCreatePostInput(input: any): ValidationResult {
  const errors: ValidationError[] = [];

  errors.push(
    ...validateString(input.content, 'content', {
      required: true,
      minLength: 1,
    }),
  );

  errors.push(...validateString(input.parent_post_id, 'parent_post_id'));

  if (input.tags !== undefined) {
    errors.push(
      ...validateArray(input.tags, 'tags', {
        itemValidator: (item, _index) => validateString(item, 'item', {}),
      }),
    );
  }

  if (errors.length > 0) {
    return ValidationResult.failure(errors);
  }

  // Filter and trim tags consistently
  const filteredTags =
    input.tags
      ?.map((tag: string) => trimStringValue(tag))
      .filter((tag: string | undefined) => tag !== undefined) || [];

  return ValidationResult.success({
    content: trimStringValue(input.content)!,
    tags: filteredTags,
    parent_post_id: trimStringValue(input.parent_post_id),
  });
}
