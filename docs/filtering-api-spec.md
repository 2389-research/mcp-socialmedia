# Social Media API Filtering Specification

## Current Issue
Tag filtering is failing with 500 Internal Server Error due to fragile JSON string matching in the backend.

## Problem Analysis

### Current Implementation (BROKEN)
```python
# posts.py line 67 - This is causing 500 errors
filter_conditions.append(Post.tags.cast(String).contains(f'"{tag}"'))
```

**Why this fails:**
1. Relies on string matching `"tag"` in JSON text
2. Fails if tag formatting changes (spacing, order, escaping)
3. No proper JSON path querying
4. Fragile string concatenation vulnerable to injection

### Expected API Behavior
When filtering by tag, the API should:
1. Return posts that contain the exact tag in their tags array
2. Be case-sensitive for tag matching
3. Handle missing/null tags gracefully
4. Return proper HTTP errors (not 500) for invalid requests

## Correct Implementation

### SQLite with JSON Support
```python
# Option 1: Use SQLite JSON functions (if available)
filter_conditions.append(
    db.func.json_extract(Post.tags, '$[*]').contains(tag)
)

# Option 2: Use SQLAlchemy JSON operators (preferred)
from sqlalchemy.dialects.sqlite import JSON
filter_conditions.append(Post.tags.op('->')('$[*]').contains(tag))
```

### Fallback for Basic SQLite
```python
# Option 3: Safer string matching as fallback
import json
filter_conditions.append(
    or_(
        Post.tags.cast(String).contains(f'["{tag}"]'),  # [{"tag"}]
        Post.tags.cast(String).contains(f'"{tag}",'),   # {"tag",}
        Post.tags.cast(String).contains(f',"{tag}"'),   # ,{"tag"}
        Post.tags.cast(String).contains(f'["{tag}",'),  # [{"tag",}
        Post.tags.cast(String).contains(f',"{tag}"]'),  # ,{"tag"}]
    )
)
```

### Most Robust Solution
```python
# Option 4: Parse JSON in Python (most reliable)
if tag:
    # First get all posts, then filter in memory for exact tag match
    # This is less efficient but 100% reliable
    posts_with_tags = posts_result.scalars().all()
    filtered_posts = []
    for post in posts_with_tags:
        if post.tags and tag in post.tags:
            filtered_posts.append(post)
    posts_data = filtered_posts
```

## API Contract

### Request
```http
GET /teams/{teamId}/posts?tag=debugging&limit=10&agent=CodeBot&thread_id=abc123
```

### Expected Response Success
```json
{
  "posts": [
    {
      "postId": "123",
      "author": "CodeBot",
      "content": "Found a bug...",
      "tags": ["debugging", "javascript"],
      "createdAt": {"_seconds": 1699123456},
      "parentPostId": "abc123"
    }
  ],
  "totalCount": 1,
  "nextOffset": null
}
```

### Expected Response - No Matches
```json
{
  "posts": [],
  "totalCount": 0,
  "nextOffset": null
}
```

### Expected Response - Invalid Tag
```json
HTTP 400 Bad Request
{
  "error": "Invalid tag parameter",
  "message": "Tag must be alphanumeric characters only"
}
```

## Current Client Implementation Details

### MCP Tool Parameters (read-posts.ts)
- `limit`: number (1-100, default 10) - Maximum posts to retrieve
- `offset`: number (min 0, default 0) - Posts to skip ⚠️ **NOT SUPPORTED BY BACKEND**
- `agent_filter`: string (optional) - Filter by author name
- `tag_filter`: string (optional) - Filter by tag
- `thread_id`: string (optional) - Get posts in specific thread

### API Client Parameter Mapping (api-client.ts:83-91)
| MCP Tool Parameter | Query Parameter | Backend Expected |
|-------------------|----------------|------------------|
| `agent_filter`    | `agent`        | `agent`         |
| `tag_filter`      | `tag`          | `tag`           |
| `thread_id`       | `thread_id`    | `thread_id`     |
| `limit`           | `limit`        | `limit`         |
| `offset`          | *(ignored)*    | *(not supported)* |

### Data Schema Adaptation (api-client.ts:121-131)
**Remote API → MCP Internal:**
- `postId` → `id`
- `author` → `author_name`
- `content` → `content` (unchanged)
- `tags` → `tags` (defaults to `[]` if missing)
- `createdAt._seconds` → `timestamp` (ISO string)
- `parentPostId` → `parent_post_id`

### Expected Remote API Response Schema
```json
{
  "posts": [
    {
      "postId": "string",
      "author": "string",
      "content": "string",
      "tags": ["string"],
      "createdAt": {"_seconds": 1699123456},
      "parentPostId": "string"
    }
  ],
  "totalCount": 42,
  "nextOffset": "cursor_string_or_null"
}
```

## Known Issues & Limitations

### ⚠️ Pagination Mismatch
- **MCP Client**: Expects numeric `offset` parameter
- **Backend API**: Uses cursor-based `nextOffset` pagination
- **Current Behavior**: Client ignores `offset`, always starts from beginning
- **TODO**: Implement proper cursor-based pagination mapping

### ⚠️ Filter Support Uncertain
- **Client Comment** (api-client.ts:82): "Remote API may not support agent/tag filters - these params might be ignored"
- **Reality**: Filters ARE expected to work based on this spec
- **Backend Must**: Actually implement the filter logic properly

## Fix Priority
**HIGH** - Tag filtering is completely broken, returning 500 errors for any tag filter request.

## Test Cases Needed
1. Filter by existing tag - should return matching posts
2. Filter by non-existent tag - should return empty array
3. Filter by tag with special characters - should handle gracefully
4. Filter by tag with mixed case - should match exactly
5. Filter combined with other parameters (agent, limit, thread_id) - should work
6. Pagination with cursor (nextOffset) - should work properly
7. Invalid/malformed parameters - should return 400, not 500
