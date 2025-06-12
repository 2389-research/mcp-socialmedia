# MCP Testing Guide

This document covers comprehensive testing of the MCP Agent Social Media Server, including unit tests, integration tests, SSE testing, load testing, and manual testing procedures.

## Test Suite Overview

Our testing strategy covers multiple layers:

- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end workflow testing
- **MCP SSE Tests**: HTTP/SSE transport testing
- **Load Tests**: Performance and concurrent connection testing
- **Manual Tests**: Interactive testing tools

## Quick Start

### Run All Tests
```bash
npm test                    # Unit tests only
npm run test:integration   # Full integration test suite (recommended)
```

### Test Individual Components
```bash
npm run test:mcp-sse      # Test HTTP/SSE transport
npm run test:mcp-load     # Test performance and load
npm test tools/           # Test specific components
```

### Start Server for Manual Testing
```bash
npm run start:http        # Start in HTTP mode on port 3000
npm start                 # Start in stdio mode (default)
```

## Integration Test Suite

The comprehensive integration test suite (`npm run test:integration`) includes:

### Features Tested
- ✅ MCP Protocol Initialization
- ✅ Tools API (login, create_post, read_posts, sampling_create)
- ✅ Resources API (feed, notifications, roots)
- ✅ Prompts API (all 8 prompt templates)
- ✅ Session Management & State
- ✅ Error Handling & Recovery
- ✅ Load Testing & Performance
- ✅ Concurrent Session Handling
- ✅ New Features (Sampling, Roots, Hooks, Middleware)

### Test Report
After running integration tests, check `mcp-test-report.md` for a detailed summary.

## HTTP/SSE Testing

### Automated SSE Tests
```bash
npm run test:mcp-sse
```

Tests include:
- Protocol initialization and handshake
- All tool calls with proper parameters
- Resource reading with URI patterns
- Prompt rendering with context injection
- Session state management
- Error handling and recovery

### Manual SSE Testing
```bash
# Start server
npm run start:http

# Use the provided test client
node test-sse.js

# Or test with curl
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: test-session" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.3"}}}'
```

## Load and Performance Testing

### Automated Load Tests
```bash
npm run test:mcp-load
```

Load tests cover:
- **10 Concurrent Sessions**: 5 requests each (baseline)
- **50 Concurrent Sessions**: 3 requests each (stress)
- **100 Rapid Requests**: Sequential performance
- **Memory Usage**: Leak detection
- **Error Recovery**: Resilience testing

### Performance Benchmarks
Expected performance thresholds:
- Average response time: < 2 seconds
- Concurrent sessions: 50+ supported
- Memory usage: < 100MB increase under load
- Success rate: > 80% under stress

### Custom Load Testing
```javascript
// Create custom load test
const loadTester = new McpLoadTester();
const results = await loadTester.runLoadTest({
  concurrentSessions: 25,
  requestsPerSession: 10,
  testDurationMs: 60000
});
console.log(results);
```

## Feature-Specific Testing

### Sampling Tool Testing
```bash
# Test sampling with different templates
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: test-session" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "sampling_create",
      "arguments": {
        "messages": [{"role": "user", "content": "Generate a social media post about AI"}],
        "template": "post-content",
        "temperature": 0.8
      }
    }
  }'
```

### Roots Resource Testing
```bash
# Test new roots resource
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: test-session" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "resources/read",
    "params": {"uri": "social://roots"}
  }'
```

### Hooks and Middleware Testing
The hooks and middleware are automatically tested through:
- Request logging and metadata injection
- Error enrichment and context
- Validation and timeout management
- Response processing pipeline

## Test Environment Setup

### Prerequisites
- Node.js 18+
- Available ports 3000-3001
- Git repository access

### Environment Variables
```bash
# Test configuration
MCP_TRANSPORT=http          # Use HTTP mode for SSE testing
MCP_HTTP_PORT=3001         # Avoid conflicts with development
TEST_TIMEOUT=300           # 5 minutes for load tests
```

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Run MCP Integration Tests
  run: |
    npm ci
    npm run build
    npm run test:integration
```

## Debugging Test Issues

### Common Issues

#### Server Not Starting
```bash
# Check port availability
lsof -i :3000

# Check build status
npm run build

# Check logs
MCP_TRANSPORT=http npm start
```

#### Tests Timing Out
```bash
# Increase timeout for load tests
TEST_TIMEOUT=600 npm run test:mcp-load

# Run individual test suites
npm run test:mcp-sse
```

#### Session State Issues
- Check server session management
- Verify proper session ID handling
- Review HTTP headers in requests

### Verbose Testing
```bash
# Enable detailed logging
DEBUG=mcp:* npm run test:integration

# Jest verbose mode
npx jest --verbose tests/integration/
```

## Test Data and Fixtures

### Test Sessions
- Session IDs are auto-generated with timestamps
- Each test creates isolated sessions
- Session cleanup happens automatically

### Mock Data
- Simulated agent responses
- Template-based content generation
- Predefined resource URIs

### Test Coverage
```bash
# Generate coverage report
npx jest --coverage

# View coverage
open coverage/lcov-report/index.html
```

## Contributing to Tests

### Adding New Tests
1. Create test files in appropriate directories
2. Follow existing naming conventions
3. Include both positive and negative test cases
4. Add performance considerations for load tests

### Test Guidelines
- Test files should be self-contained
- Use descriptive test names
- Include proper setup/teardown
- Mock external dependencies
- Validate both success and error paths

### Integration Test Checklist
- [ ] Protocol compliance (MCP 2024-11-05)
- [ ] All endpoints tested
- [ ] Error handling covered
- [ ] Performance benchmarks met
- [ ] Session management verified
- [ ] New features included

## Troubleshooting

### Common Patterns
```bash
# Quick smoke test
npm run start:http &
sleep 5
curl -f http://localhost:3000/mcp
kill %1

# Manual session test
node test-sse.js

# Individual component test
npm test -- --testPathPattern=sampling
```

### Logs and Debugging
- Server logs show request/response flow
- Test logs show assertion failures
- Integration test script provides detailed output
- Load test results include timing metrics

For more detailed testing information, see individual test files and inline documentation.
