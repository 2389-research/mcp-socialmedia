# Test Coverage Improvement Plan

## Current Coverage Status
- **Overall**: 71.31% statements, 64.25% branches, 72.27% functions
- **Target**: 85%+ statement coverage, 80%+ branch coverage

## Priority 1: Critical Gaps (0-50% coverage)

### 1. Server Startup/Shutdown Tests (index.ts - 0% coverage)
**Impact**: High - Core server functionality untested
**Effort**: Medium - Need to mock MCP server and stdio transport

#### Tests to add:
- [ ] Server initialization with valid config
- [ ] Server initialization with invalid config
- [ ] Graceful shutdown on SIGINT/SIGTERM
- [ ] Error handling for stdin/stdout errors
- [ ] Uncaught exception handling
- [ ] Unhandled rejection handling
- [ ] Session cleanup on shutdown
- [ ] Metrics shutdown on exit
- [ ] Cleanup interval management

**File**: `tests/server-startup.test.ts` (new)

```typescript
// Example test structure
describe('Server Startup and Shutdown', () => {
  describe('Initialization', () => {
    it('should start server with valid config')
    it('should fail with missing environment variables')
    it('should connect to stdio transport')
    it('should register all tools')
  })

  describe('Shutdown', () => {
    it('should handle SIGINT gracefully')
    it('should clean up sessions on shutdown')
    it('should shutdown metrics collector')
    it('should handle server close errors')
  })
})
```

## Priority 2: Moderate Gaps (50-70% coverage)

### 2. Logger Edge Cases (logger.ts - 61.36% coverage)
**Impact**: Medium - Missing error scenarios and log levels
**Effort**: Low - Simple unit tests

#### Tests to add:
- [ ] SILENT log level behavior
- [ ] Error object formatting with circular references
- [ ] Log methods with null/undefined errors
- [ ] Performance logging edge cases
- [ ] Metrics logging scenarios

**File**: `tests/logger-edge-cases.test.ts` (new)

```typescript
describe('Logger Edge Cases', () => {
  it('should handle SILENT log level')
  it('should format circular reference errors')
  it('should handle null error objects')
  it('should log performance metrics')
})
```

### 3. Validation Error Paths (validation.ts - 78.49% coverage)
**Impact**: Medium - Input validation edge cases
**Effort**: Low - Unit tests for error conditions

#### Tests to add:
- [ ] Special field name error messages (content field)
- [ ] Array validation with invalid items
- [ ] Number validation with NaN
- [ ] String validation with null/undefined
- [ ] Max length validation errors

**File**: Update `tests/validation.test.ts` (new)

## Priority 3: Good Coverage Improvements (70-90%)

### 4. Metrics Edge Cases (metrics.ts - 80% coverage)
**Impact**: Low - Performance monitoring edge cases
**Effort**: Medium - Need to test timeouts

#### Tests to add:
- [ ] Stale operation cleanup (5-minute timeout)
- [ ] Operation tracking with errors
- [ ] System metrics with high memory usage
- [ ] Concurrent operation tracking
- [ ] Reset during active operations

**File**: Update `tests/metrics.test.ts` (new)

### 5. API Client Error Paths (api-client.ts - 90.76% coverage)
**Impact**: Low - Already well tested
**Effort**: Low - A few error scenarios

#### Tests to add:
- [ ] Response without ok status but no error body
- [ ] Network errors during request
- [ ] Invalid JSON response handling

## Implementation Strategy

### Phase 1 (Week 1)
1. Create `tests/server-startup.test.ts`
   - Mock MCP server and transport
   - Test initialization and shutdown
   - Test signal handlers

2. Create `tests/logger-edge-cases.test.ts`
   - Test all log levels
   - Test error formatting edge cases

### Phase 2 (Week 2)
3. Create `tests/validation.test.ts`
   - Test all validation functions
   - Cover all error messages
   - Test edge cases

4. Create `tests/metrics.test.ts`
   - Test stale operation cleanup
   - Test concurrent operations
   - Test memory tracking

### Phase 3 (Week 3)
5. Update existing test files
   - Add missing API client error tests
   - Add config edge cases
   - Integration test improvements

## Testing Best Practices

### 1. Test Organization
- One test file per source file
- Group related tests in describe blocks
- Use clear, descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### 2. Mocking Strategy
- Mock external dependencies (MCP SDK, fetch)
- Use jest.spyOn for partial mocks
- Clear mocks between tests
- Verify mock calls when appropriate

### 3. Coverage Goals
- Aim for 100% coverage on business logic
- Accept lower coverage on infrastructure
- Focus on meaningful tests, not just coverage
- Test error paths and edge cases

### 4. Test Data
- Use realistic test data
- Create test fixtures for complex objects
- Avoid magic numbers/strings
- Use constants for repeated values

## Success Metrics

### Coverage Targets
- Statement coverage: 85%+
- Branch coverage: 80%+
- Function coverage: 85%+
- Line coverage: 85%+

### Quality Metrics
- All tests pass consistently
- Tests run in < 5 seconds
- No flaky tests
- Clear test output on failure

## Maintenance Plan

### Regular Tasks
1. Run coverage report weekly
2. Add tests for new features
3. Update tests when refactoring
4. Review and remove obsolete tests

### CI/CD Integration
1. Run tests on every commit
2. Block PRs below coverage threshold
3. Generate coverage badges
4. Track coverage trends

## Notes

- Current test infrastructure is solid
- Focus on missing infrastructure tests
- Consider using GitHub Actions for CI
- May need to refactor index.ts for better testability
