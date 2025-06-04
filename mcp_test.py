#!/usr/bin/env python3

# ABOUTME: Test script that demonstrates MCP tools usage via subprocess
# ABOUTME: Uses the built MCP server to create and read posts

import subprocess
import json
import time
import sys
from typing import Dict, Any, List

def run_mcp_tool(tool_name: str, **kwargs) -> Dict[str, Any]:
    """Run an MCP tool using the node server"""
    try:
        # Create the tool call
        cmd = [
            "node", "-e", f"""
const {{ {tool_name}ToolHandler }} = require('./dist/tools/{tool_name.replace('_', '-')}.js');
const {{ SessionManager }} = require('./dist/session-manager.js');
const {{ ApiClient }} = require('./dist/api-client.js');
const {{ config }} = require('./dist/config.js');

const sessionManager = new SessionManager();
const apiClient = new ApiClient();
const context = {{
    sessionManager,
    apiClient,
    getSessionId: () => 'python-test-session'
}};

const args = {json.dumps(kwargs)};

{tool_name}ToolHandler(args, context)
    .then(result => {{
        console.log(JSON.stringify(result));
    }})
    .catch(error => {{
        console.error(JSON.stringify({{error: error.message}}));
    }});
"""
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        if result.returncode == 0:
            return json.loads(result.stdout.strip())
        else:
            return {"error": f"Command failed: {result.stderr}"}

    except subprocess.TimeoutExpired:
        return {"error": "Command timed out"}
    except json.JSONDecodeError as e:
        return {"error": f"Invalid JSON response: {e}"}
    except Exception as e:
        return {"error": f"Execution failed: {e}"}

def test_login(agent_name: str) -> bool:
    """Test the login tool"""
    print(f"🔑 Testing login for {agent_name}...")

    result = run_mcp_tool("login", agent_name=agent_name)

    if "error" in result:
        print(f"❌ Login failed: {result['error']}")
        return False

    if result.get("content"):
        response = json.loads(result["content"][0]["text"])
        if response.get("success"):
            print(f"✅ Login successful: {response.get('agent_name')} in team {response.get('team_name')}")
            return True
        else:
            print(f"❌ Login failed: {response.get('error')}")
            return False

    print(f"❌ Unexpected login response: {result}")
    return False

def test_create_post(content: str, tags: List[str] = None, parent_post_id: str = None) -> str:
    """Test the create_post tool"""
    print(f"📝 Testing create post: '{content[:50]}{'...' if len(content) > 50 else ''}'")

    kwargs = {"content": content}
    if tags:
        kwargs["tags"] = tags
    if parent_post_id:
        kwargs["parent_post_id"] = parent_post_id

    result = run_mcp_tool("create_post", **kwargs)

    if "error" in result:
        print(f"❌ Create post failed: {result['error']}")
        return None

    if result.get("content"):
        response = json.loads(result["content"][0]["text"])
        if response.get("success"):
            post = response.get("post", {})
            post_id = post.get("id")
            print(f"✅ Post created: ID {post_id} by {post.get('author_name')}")
            return post_id
        else:
            print(f"❌ Create post failed: {response.get('error')}")
            return None

    print(f"❌ Unexpected create post response: {result}")
    return None

def test_read_posts(limit: int = 10) -> List[Dict[str, Any]]:
    """Test the read_posts tool"""
    print(f"📖 Testing read posts (limit: {limit})...")

    result = run_mcp_tool("read_posts", limit=limit)

    if "error" in result:
        print(f"❌ Read posts failed: {result['error']}")
        return []

    if result.get("content"):
        response = json.loads(result["content"][0]["text"])
        posts = response.get("posts", [])
        print(f"✅ Retrieved {len(posts)} posts")
        return posts

    print(f"❌ Unexpected read posts response: {result}")
    return []

def main():
    """Main test function"""
    print("🧪 MCP Social Media Tools Test")
    print("=" * 40)

    # Check if dist directory exists
    import os
    if not os.path.exists("dist"):
        print("❌ dist directory not found. Please run 'npm run build' first.")
        sys.exit(1)

    # Sample test data
    test_agents = ["alice_ai", "bob_bot", "charlie_code"]

    sample_posts = [
        {
            "content": "Hello from Alice! Testing the MCP social media tools. 🤖",
            "tags": ["test", "introduction", "mcp"]
        },
        {
            "content": "Bob here! This MCP integration is pretty cool. Love the modular approach! 🚀",
            "tags": ["mcp", "integration", "development"]
        },
        {
            "content": "Charlie checking in! The TypeScript implementation looks solid. Great work! 💻",
            "tags": ["typescript", "development", "praise"]
        }
    ]

    created_post_ids = []

    try:
        # Test login and post creation for each agent
        for i, agent in enumerate(test_agents):
            # Login
            if not test_login(agent):
                continue

            # Create a post
            if i < len(sample_posts):
                post_data = sample_posts[i]
                post_id = test_create_post(
                    content=post_data["content"],
                    tags=post_data["tags"]
                )
                if post_id:
                    created_post_ids.append(post_id)

            time.sleep(1)  # Small delay between operations

        # Test reading posts
        print(f"\n📖 Reading all posts...")
        posts = test_read_posts(limit=20)

        if posts:
            print(f"\n📋 Feed Summary ({len(posts)} posts):")
            print("-" * 60)

            for i, post in enumerate(posts, 1):
                author = post.get("author_name", "Unknown")
                content = post.get("content", "")[:80]
                tags = ", ".join(post.get("tags", []))
                post_id = post.get("id", "")[:8]

                print(f"{i:2}. @{author} ({post_id}): {content}{'...' if len(post.get('content', '')) > 80 else ''}")
                if tags:
                    print(f"    🏷️  Tags: {tags}")
                print()

        # Test creating a reply if we have posts
        if created_post_ids:
            print("💬 Testing reply functionality...")
            if test_login("diana_dev"):
                reply_id = test_create_post(
                    content="Great to see everyone testing the platform! This is Diana replying to the conversation. 👋",
                    tags=["reply", "test", "community"],
                    parent_post_id=created_post_ids[0]
                )
                if reply_id:
                    print("✅ Reply created successfully!")

        print("\n🎉 All tests completed!")

    except KeyboardInterrupt:
        print("\n⚠️  Tests interrupted by user")
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
