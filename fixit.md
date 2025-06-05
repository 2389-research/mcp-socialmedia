# MCP Social Media Server - Fix Plan

## Overview

This document outlines the issues found during code review and provides a prioritized plan for fixing them.

## Critical Issues (Priority 1)

### 1. Performance Problem in Parent Post Validation

**File**: `src/tools/create-post.ts` (lines 76-115)
**Issue**: Fetches up to 101 posts to validate if a parent post exists
**Impact**: Severe performance degradation, especially with large post volumes
**Fix**:

- Option A: Add a dedicated endpoint to check post existence by ID
- Option B: Implement a local cache for recently fetched posts
- Option C: Remove parent validation and handle invalid parents gracefully
  **Estimated Time**: 2-3 hours

### 2. Type Safety - Remove `any` Types

**Files**: All tool handlers (`login.ts`, `read-posts.ts`, `create-post.ts`)
**Issue**: Using `input: any` defeats TypeScript's type checking
**Impact**: Potential runtime errors, poor IDE support
**Fix**:

```typescript
// Use Zod's type inference
import { z } from 'zod';

// Define the input schema
const loginInputSchema = z.object({
  agent_name: z.string().min(1),
});

// Infer the type
type LoginInput = z.infer<typeof loginInputSchema>;

// Use in handler
export async function loginToolHandler(
  input: LoginInput, // Now properly typed
  context: LoginToolContext
);
```

**Estimated Time**: 1 hour

### 3. Memory Leak in Metrics System

**File**: `src/metrics.ts`
**Issue**: `activeOperations` Map can grow indefinitely
**Impact**: Memory exhaustion in long-running processes
**Fix**:

```typescript
// Add timeout mechanism
private readonly OPERATION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

private cleanupStaleOperations(): void {
  const now = Date.now();
  for (const [id, startTime] of this.activeOperations.entries()) {
    if (now - startTime > this.OPERATION_TIMEOUT) {
      this.activeOperations.delete(id);
      this.recordOperation(id.split('_')[0], this.OPERATION_TIMEOUT, 'timeout');
    }
  }
}

// Run cleanup periodically
constructor() {
  setInterval(() => this.cleanupStaleOperations(), 60000); // Every minute
}
```

**Estimated Time**: 1 hour

## Moderate Issues (Priority 2)

### 4. Fix Session Lock Implementation

**File**: `src/session-manager.ts`
**Issue**: `sessionLock` is declared but never used
**Impact**: Potential race conditions in concurrent environments
**Fix**:

```typescript
async createSession(sessionId: string, agentName: string): Promise<Session> {
  // Implement actual locking
  const releaseLock = await this.acquireLock();
  try {
    const session: Session = {
      sessionId,
      agentName,
      loginTimestamp: new Date(),
    };
    this.sessions.set(sessionId, session);
    return session;
  } finally {
    releaseLock();
  }
}

private async acquireLock(): Promise<() => void> {
  const currentLock = this.sessionLock;
  let releaseLock: () => void;
  this.sessionLock = new Promise((resolve) => {
    releaseLock = resolve;
  });
  await currentLock;
  return releaseLock!;
}
```

**Estimated Time**: 1 hour

### 5. API Pagination Support

**File**: `src/api-client.ts`
**Issue**: `offset` parameter is ignored, cursor-based pagination not implemented
**Impact**: Can't paginate through large result sets
**Fix**:

- Implement cursor mapping between offset and API cursors
- Or document that offset-based pagination is not supported
- Consider switching to cursor-based interface
  **Estimated Time**: 2-3 hours

### 6. Standardize Validation Trimming

**File**: `src/validation.ts`
**Issue**: Inconsistent trimming behavior across validators
**Impact**: Potential validation errors due to whitespace
**Fix**:

- Create a consistent trimming strategy
- Apply to all string inputs before validation
- Document the behavior
  **Estimated Time**: 30 minutes

## Minor Issues (Priority 3)

### 7. Fix Error Response Types

**File**: `src/types.ts`
**Issue**: `ReadPostsToolResponse` has all optional fields
**Impact**: Undefined values in error responses
**Fix**:

```typescript
// Use discriminated unions
export type ReadPostsToolResponse =
  | {
      success: true;
      posts: Post[];
      limit: number;
      offset: number;
      total: number;
      has_more: boolean;
    }
  | {
      success: false;
      error: string;
      details?: string;
    };
```

**Estimated Time**: 1 hour

### 8. Add Request Limits

**Files**: `src/api-client.ts`, `src/validation.ts`
**Issue**: No request size limits or rate limiting
**Impact**: Potential abuse or resource exhaustion
**Fix**:

- Add max content length validation
- Implement basic rate limiting
- Add request size limits in validation
  **Estimated Time**: 2 hours

## Implementation Order

### Phase 1 (Day 1)

1. Fix type safety issues (remove `any`)
2. Fix memory leak in metrics
3. Standardize validation trimming

### Phase 2 (Day 2)

1. Fix parent post validation performance
2. Implement proper session locking
3. Fix error response types

### Phase 3 (Day 3)

1. Add request limits and rate limiting
2. Address API pagination
3. Update documentation

## Testing Requirements

After each fix:

1. Run existing test suite: `npm test`
2. Run linter: `npm run lint`
3. Run type checker: `npm run typecheck`
4. Add new tests for fixed functionality
5. Manual testing with Claude Desktop

## Success Criteria

- All tests passing
- No linting errors
- No TypeScript errors
- Performance tests show < 100ms for parent validation
- Memory usage remains stable over 24-hour test run
- Documentation updated for any API changes

## Notes

- Consider adding integration tests for the full MCP flow
- May need to coordinate with API team for pagination changes
- Performance monitoring should be added after fixes
- Consider adding GitHub Actions for CI/CD
