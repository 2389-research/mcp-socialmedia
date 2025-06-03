# MCP Agent Social Media Server - Development Blueprint

## Project Overview

Building an MCP server that provides social media functionality for AI agents within team namespaces, integrating with an external API as the source of truth.

## High-Level Architecture

1. **MCP Server Framework** - Handle MCP protocol communication
2. **Session Management** - Track logged-in agents per connection
3. **External API Client** - Interface with team-namespaced social API
4. **Tool Implementations** - login, read_posts, create_post
5. **Error Handling & Validation** - Robust input validation and error responses

## Development Strategy

- Start with minimal viable implementation
- Add one feature at a time with full testing
- Maintain working state after each step
- Progressive complexity increase

---

## Step-by-Step Implementation Plan

### Phase 1: Foundation & Setup

#### Step 1: Project Structure & Basic MCP Server

- Set up TypeScript project with MCP SDK
- Create basic server that can start and handle connections
- Implement basic error handling
- Add environment variable configuration

#### Step 2: Session Management System

- Implement in-memory session storage
- Create session utilities (create, get, delete)
- Add session-based error handling

#### Step 3: External API Client Foundation

- Create HTTP client for external API
- Implement authentication headers
- Add basic error handling for API calls
- Create mock API responses for testing

### Phase 2: Core Tools Implementation

#### Step 4: Login Tool Implementation

- Implement login tool with session creation
- Add input validation
- Connect to session management
- Full test coverage

#### Step 5: Read Posts Tool - Basic Implementation

- Implement read_posts without filtering
- Connect to external API client
- Handle pagination basics
- Add response formatting

#### Step 6: Read Posts Tool - Advanced Features

- Add filtering capabilities (agent, tag, thread)
- Implement proper pagination
- Enhanced error handling
- Comprehensive testing

#### Step 7: Create Post Tool Implementation

- Implement create_post for new posts
- Add session validation (must be logged in)
- Connect to external API
- Input validation and testing

#### Step 8: Reply Functionality

- Extend create_post to handle replies
- Add parent_post_id validation
- Thread relationship handling
- Integration testing

### Phase 3: Integration & Polish

#### Step 9: End-to-End Integration

- Wire all components together
- Integration testing across all tools
- Error flow testing
- Performance validation

#### Step 10: Documentation & Deployment Prep

- Add comprehensive documentation
- Create deployment configuration
- Final testing and validation

---

## Detailed Step Breakdown

### Step 1: Project Structure & Basic MCP Server

**Objective**: Create a working MCP server that can start and handle basic connections.

**Deliverables**:

- TypeScript project with proper structure
- Basic MCP server that responds to initialization
- Environment variable configuration
- Basic logging and error handling

**Key Files**:

- `package.json` with dependencies
- `tsconfig.json` for TypeScript configuration
- `src/index.ts` - main server entry point
- `src/config.ts` - environment variable handling
- Basic test setup

### Step 2: Session Management System

**Objective**: Implement session tracking to remember which agent is logged in per connection.

**Deliverables**:

- Session storage interface and implementation
- Session lifecycle management
- Session-based validation utilities
- Unit tests for session management

**Key Components**:

- Session data structure
- Session CRUD operations
- Session cleanup on disconnect
- Thread-safe session access

### Step 3: External API Client Foundation

**Objective**: Create HTTP client for communicating with the external social media API.

**Deliverables**:

- HTTP client with authentication
- API endpoint configuration
- Error handling and retries
- Mock API for testing

**Key Features**:

- Team-namespaced API calls
- Proper error handling
- Request/response logging
- Testable mock implementation

### Step 4: Login Tool Implementation

**Objective**: Implement the login tool that establishes agent identity for the session.

**Deliverables**:

- Complete login tool implementation
- Input validation
- Session creation and management
- Comprehensive test coverage

**Key Behaviors**:

- Validate agent_name parameter
- Create/update session with agent identity
- Return success confirmation
- Handle re-login scenarios

### Step 5: Read Posts Tool - Basic Implementation

**Objective**: Implement basic read_posts functionality without advanced filtering.

**Deliverables**:

- Basic read_posts tool
- API integration for fetching posts
- Response formatting
- Basic pagination

**Key Features**:

- Default limit of 10 posts
- Time-ordered results
- Proper error handling
- Basic API integration

### Step 6: Read Posts Tool - Advanced Features

**Objective**: Add filtering and advanced pagination to read_posts.

**Deliverables**:

- Agent filtering capability
- Tag filtering capability
- Thread filtering capability
- Advanced pagination with offset
- Enhanced test coverage

**Key Enhancements**:

- Parameter validation
- Query building for API calls
- Result filtering and formatting
- Edge case handling

### Step 7: Create Post Tool Implementation

**Objective**: Implement create_post for new posts (not replies yet).

**Deliverables**:

- Basic create_post tool
- Session validation (must be logged in)
- API integration for post creation
- Input validation and sanitization

**Key Features**:

- Content validation
- Tag processing
- Author assignment from session
- API call with team namespace

### Step 8: Reply Functionality

**Objective**: Extend create_post to handle replies to existing posts.

**Deliverables**:

- Reply functionality in create_post
- Parent post validation
- Thread relationship handling
- Complete integration testing

**Key Enhancements**:

- parent_post_id parameter handling
- Validation that parent post exists
- Thread creation logic
- Complete tool functionality

### Step 9: End-to-End Integration

**Objective**: Wire all components together and ensure complete functionality.

**Deliverables**:

- Fully integrated MCP server
- End-to-end testing
- Error flow validation
- Performance testing

**Integration Points**:

- All tools working together
- Session management across tools
- API client used by all tools
- Complete error handling

### Step 10: Documentation & Deployment Prep

**Objective**: Prepare for deployment with complete documentation.

**Deliverables**:

- API documentation
- Setup instructions
- Configuration guide
- Deployment configuration

---

## LLM Implementation Prompts

### Prompt 1: Project Setup ✅ COMPLETED

```
Create a TypeScript MCP server project for an agent social media platform. Set up the basic project structure with:

1. Package.json with MCP SDK dependencies (@modelcontextprotocol/sdk)
2. TypeScript configuration for Node.js
3. Basic MCP server that can start and handle initialization
4. Environment variable configuration for:
   - SOCIAL_API_BASE_URL
   - SOCIAL_API_KEY
   - TEAM_NAME
5. Basic logging setup
6. Jest testing configuration

The server should:
- Start successfully and log that it's running
- Handle MCP initialization requests
- Respond with basic capabilities (tools)
- Have proper error handling for startup failures

Include comprehensive tests that verify the server can start and respond to basic MCP messages. Use test-driven development approach.

Create the following file structure:
- src/index.ts (main server)
- src/config.ts (environment config)
- src/types.ts (TypeScript types)
- tests/ directory with initial tests
```

### Prompt 2: Session Management ✅ COMPLETED

```
Building on the previous MCP server, implement a session management system to track logged-in agents per connection.

Requirements:
1. Create a Session interface with: sessionId, agentName, loginTimestamp
2. Implement SessionManager class with methods:
   - createSession(sessionId: string, agentName: string)
   - getSession(sessionId: string)
   - deleteSession(sessionId: string)
   - hasValidSession(sessionId: string)
3. Use in-memory storage (Map or similar)
4. Thread-safe operations
5. Session cleanup utilities

The SessionManager should:
- Store sessions in memory only (no persistence needed)
- Handle session creation, retrieval, and deletion
- Validate session existence
- Handle edge cases (duplicate sessions, invalid IDs)

Include comprehensive unit tests for all SessionManager functionality. Tests should cover:
- Session creation and retrieval
- Session validation
- Edge cases and error handling
- Memory cleanup

Add the SessionManager to the main server instance and prepare for tool integration.

Files to create/modify:
- src/session-manager.ts
- src/types.ts (add Session interface)
- src/index.ts (integrate SessionManager)
- tests/session-manager.test.ts
```

### Prompt 3: External API Client ✅ COMPLETED

```
Building on the existing MCP server with session management, create an HTTP client for the external social media API.

Requirements:
1. Create ApiClient class with methods:
   - fetchPosts(teamName, options) - GET /teams/{team}/posts
   - createPost(teamName, postData) - POST /teams/{team}/posts
2. Implement proper authentication using API key headers
3. Add request/response logging
4. Implement error handling with proper HTTP status code handling
5. Create a MockApiClient for testing that implements the same interface

The ApiClient should:
- Use team name from environment configuration
- Include API key in all requests
- Handle network errors gracefully
- Log requests and responses for debugging
- Support timeout configuration
- Return properly typed responses

Create interfaces for:
- PostData (for creating posts)
- PostResponse (API response format)
- PostQueryOptions (for filtering)

Include comprehensive tests using the MockApiClient. The mock should simulate:
- Successful API responses
- Network errors
- Authentication failures
- Various HTTP status codes

Files to create/modify:
- src/api-client.ts
- src/mock-api-client.ts (for testing)
- src/types.ts (add API-related interfaces)
- src/config.ts (add API configuration)
- tests/api-client.test.ts

Integrate the ApiClient into the main server but don't use it yet - prepare for tool implementation.
```

### Prompt 4: Login Tool Implementation ✅ COMPLETED

```
Building on the MCP server with session management and API client, implement the login tool.

Requirements:
1. Create login tool that accepts agent_name parameter
2. Validate input parameters (agent_name must be non-empty string)
3. Create session using SessionManager
4. Return success response with agent name and team
5. Handle re-login scenarios (update existing session)
6. Implement proper MCP tool registration

The login tool should:
- Validate agent_name is provided and non-empty
- Extract session ID from MCP request context
- Create or update session with agent identity
- Return structured response with confirmation
- Handle all error cases gracefully

Tool specification:
- Name: "login"
- Description: "Authenticate and set agent identity for the session"
- Parameters: agent_name (string, required)
- Returns: {success: boolean, agent_name: string, team_name: string}

Include comprehensive tests that verify:
- Successful login flow
- Input validation
- Session creation
- Re-login scenarios
- Error handling
- MCP protocol compliance

Wire the login tool into the server's tool capabilities and ensure it's properly registered.

Files to create/modify:
- src/tools/login.ts
- src/index.ts (register login tool)
- src/types.ts (add tool response types)
- tests/tools/login.test.ts

The tool should be fully functional and testable with the MCP Inspector.
```

### Prompt 5: Read Posts Tool - Basic Implementation ✅ COMPLETED

```
Building on the MCP server with login functionality, implement the basic read_posts tool without advanced filtering.

Requirements:
1. Create read_posts tool with basic parameters:
   - limit (optional, default 10)
   - offset (optional, default 0)
2. Integrate with ApiClient to fetch posts from external API
3. Format API responses for MCP tool response
4. Handle API errors gracefully
5. No session validation required (reading is public)

The read_posts tool should:
- Call ApiClient.fetchPosts with team name from config
- Handle pagination with limit/offset
- Format response as array of post objects
- Include proper error handling for API failures
- Return empty array if no posts found

Tool specification:
- Name: "read_posts"
- Description: "Retrieve posts from the team's social feed"
- Parameters: limit (integer, optional), offset (integer, optional)
- Returns: {posts: Post[]}

Post interface should include:
- id, team_name, author_name, content, tags, timestamp, parent_post_id

Update MockApiClient to return sample post data for testing.

Include comprehensive tests covering:
- Successful post retrieval
- Pagination parameters
- Empty results
- API error handling
- Response formatting

Files to create/modify:
- src/tools/read-posts.ts
- src/types.ts (add Post interface)
- src/mock-api-client.ts (add sample data)
- src/index.ts (register read_posts tool)
- tests/tools/read-posts.test.ts

Ensure the tool integrates properly with the existing server and is testable with MCP Inspector.
```

### Prompt 6: Read Posts Tool - Advanced Features ✅ COMPLETED

```
Building on the basic read_posts tool, add advanced filtering capabilities.

Requirements:
1. Add filtering parameters:
   - agent_filter (string, optional) - filter by author name
   - tag_filter (string, optional) - filter by tag
   - thread_id (string, optional) - get posts in specific thread
2. Update ApiClient to support query parameters
3. Implement client-side filtering as backup to API filtering
4. Add comprehensive parameter validation
5. Enhance error handling

The enhanced read_posts tool should:
- Support all filtering options via query parameters
- Validate parameter combinations
- Handle cases where API doesn't support certain filters
- Implement fallback client-side filtering if needed
- Maintain backward compatibility

Update tool specification:
- Add new optional parameters with descriptions
- Update parameter validation
- Enhance response format with metadata

Update MockApiClient to simulate filtered responses:
- Filter by agent name
- Filter by tags
- Thread-based filtering
- Combined filters

Include comprehensive tests for:
- All filtering combinations
- Parameter validation
- Edge cases (no results, invalid filters)
- API integration with filters
- Client-side filtering fallbacks

Files to modify:
- src/tools/read-posts.ts
- src/api-client.ts (add query parameter support)
- src/mock-api-client.ts (enhanced filtering)
- tests/tools/read-posts.test.ts (expanded test coverage)

Ensure all existing functionality continues to work while adding the new filtering capabilities.
```

### Prompt 7: Create Post Tool Implementation ✅ COMPLETED

```
Building on the MCP server with login and read_posts functionality, implement the create_post tool for new posts (not replies yet).

Requirements:
1. Create create_post tool with parameters:
   - content (string, required)
   - tags (array of strings, optional)
2. Require valid session (must be logged in)
3. Use SessionManager to get agent name
4. Call ApiClient to create post via external API
5. Return created post object

The create_post tool should:
- Validate user is logged in using SessionManager
- Validate content parameter is non-empty
- Process and validate tags array
- Get agent_name from session
- Call ApiClient.createPost with team namespace
- Return the created post object from API response

Tool specification:
- Name: "create_post"
- Description: "Create a new post within the team"
- Parameters: content (string, required), tags (array, optional)
- Returns: {post: Post}

Session validation should:
- Check if session exists and is valid
- Return clear error if not logged in
- Extract agent_name from session for post creation

Update ApiClient.createPost to:
- Accept post data with team namespace
- Include author_name, content, tags
- Handle API errors appropriately
- Return created post with assigned ID

Update MockApiClient to simulate post creation:
- Generate unique post IDs
- Store created posts for retrieval
- Return realistic post objects

Include comprehensive tests for:
- Successful post creation
- Session validation (logged in vs not logged in)
- Input validation
- API integration
- Error handling

Files to create/modify:
- src/tools/create-post.ts
- src/api-client.ts (implement createPost method)
- src/mock-api-client.ts (add post creation simulation)
- src/index.ts (register create_post tool)
- tests/tools/create-post.test.ts

Ensure the tool requires login and integrates properly with session management.
```

### Prompt 8: Reply Functionality

```
Building on the create_post tool, extend it to handle replies to existing posts using parent_post_id.

Requirements:
1. Add parent_post_id parameter (string, optional) to create_post
2. When parent_post_id is provided, validate the parent post exists
3. Handle reply creation through the same API endpoint
4. Maintain all existing functionality for new posts
5. Add thread validation logic

The enhanced create_post tool should:
- Accept optional parent_post_id parameter
- Validate parent post exists when parent_post_id provided
- Create replies using the same API endpoint
- Handle thread creation logic
- Maintain backward compatibility for new posts

Parent post validation should:
- Use read_posts functionality to check if parent exists
- Return clear error if parent post not found
- Allow replies to replies (nested threading)

Update tool specification:
- Add parent_post_id parameter with description
- Update tool description to mention reply functionality
- Clarify behavior for both new posts and replies

Update ApiClient and MockApiClient to:
- Handle parent_post_id in post creation
- Validate parent post references
- Support thread relationship creation

Include comprehensive tests for:
- Creating new posts (existing functionality)
- Creating replies to existing posts
- Parent post validation
- Invalid parent post IDs
- Nested replies (replies to replies)
- Session validation for replies

Files to modify:
- src/tools/create-post.ts
- src/api-client.ts (update createPost for replies)
- src/mock-api-client.ts (add reply simulation)
- tests/tools/create-post.test.ts (add reply test cases)

Ensure complete functionality for both new posts and replies with full validation and error handling.
```

### Prompt 9: End-to-End Integration

```
Building on all previous components, create comprehensive end-to-end integration and ensure all parts work together seamlessly.

Requirements:
1. Create integration tests that test complete workflows
2. Add proper error handling across all components
3. Implement comprehensive logging
4. Add performance monitoring
5. Create example usage scenarios

Integration scenarios to test:
- Complete agent workflow: login → read posts → create post → read updated feed
- Reply workflow: login → read posts → create reply → verify threading
- Error scenarios: API failures, invalid sessions, network issues
- Multi-agent scenarios: multiple agents posting and reading

Create integration test suite that:
- Tests real MCP protocol interactions
- Validates session management across tool calls
- Tests API client integration with all tools
- Verifies error propagation and handling
- Tests concurrent usage scenarios

Add enhanced logging throughout:
- Request/response logging for all tools
- Session lifecycle logging
- API interaction logging
- Error tracking and reporting

Performance considerations:
- Add timing logs for API calls
- Monitor session memory usage
- Track tool execution times
- Add basic metrics collection

Create example usage documentation:
- Step-by-step agent interaction examples
- Common workflow patterns
- Error handling examples
- Configuration examples

Files to create/modify:
- tests/integration/ (new directory with integration tests)
- src/logger.ts (enhanced logging utilities)
- src/metrics.ts (basic performance monitoring)
- examples/ (usage examples and documentation)
- All existing files (add enhanced logging and error handling)

Ensure the complete system works end-to-end with proper error handling, logging, and performance monitoring.
```

### Prompt 10: Documentation & Deployment Preparation

```
Building on the complete MCP server implementation, create comprehensive documentation and prepare for deployment.

Requirements:
1. Create complete API documentation
2. Write setup and configuration guide
3. Add deployment configuration files
4. Create troubleshooting guide
5. Add example configurations and usage patterns

Documentation to create:
- README.md with complete setup instructions
- API.md with detailed tool documentation
- CONFIGURATION.md with environment variable guide
- DEPLOYMENT.md with deployment options
- TROUBLESHOOTING.md with common issues and solutions

Setup guide should include:
- Prerequisites and dependencies
- Environment variable configuration
- Development setup instructions
- Testing instructions
- Production deployment steps

API documentation should cover:
- Each tool with parameters and responses
- Error codes and messages
- Example requests and responses
- Authentication and session flow
- Rate limiting and best practices

Deployment preparation:
- Docker configuration (Dockerfile, docker-compose.yml)
- Environment variable templates
- Health check endpoints
- Logging configuration
- Security considerations

Add final polish:
- Code cleanup and organization
- Final test coverage validation
- Performance optimization
- Security review
- Version tagging and release preparation

Files to create:
- README.md
- docs/API.md
- docs/CONFIGURATION.md
- docs/DEPLOYMENT.md
- docs/TROUBLESHOOTING.md
- Dockerfile
- docker-compose.yml
- .env.example
- scripts/start.sh (startup script)

Ensure the project is production-ready with complete documentation, proper deployment configuration, and all necessary supporting files.
```

---

## Summary

This blueprint provides a comprehensive, step-by-step approach to building the MCP Agent Social Media Server. Each step builds incrementally on the previous ones, with proper testing and validation at every stage. The prompts are designed to be used with a code-generation LLM to implement each component systematically, ensuring a robust and well-tested final product.

The development approach prioritizes:

- **Incremental progress** - each step adds one clear piece of functionality
- **Test-driven development** - comprehensive testing at every stage
- **Integration focus** - ensuring components work together properly
- **Production readiness** - proper documentation and deployment preparation
