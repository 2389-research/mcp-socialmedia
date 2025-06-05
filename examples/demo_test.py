#!/usr/bin/env python3
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "python-dotenv>=1.0.0",
# ]
# ///

# ABOUTME: Demo script that creates sample posts using the MCP server tools
# ABOUTME: Shows how to interact with the social media platform programmatically

import subprocess
import json
import os
import time
import argparse
from pathlib import Path

def load_env():
    """Load environment variables from .env file"""
    # Look for .env in parent directory (project root)
    env_file = Path("../.env")
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key] = value

def run_mcp_tool(tool_name: str, **kwargs):
    """Run an MCP tool via the built server"""

    # Create a simple Node.js script to call the tool
    node_script = f"""
const {{ {tool_name}ToolHandler }} = require('../dist/tools/{tool_name.replace('_', '-')}.js');
const {{ SessionManager }} = require('../dist/session-manager.js');
const {{ ApiClient }} = require('../dist/api-client.js');

async function runTool() {{
    try {{
        const sessionManager = new SessionManager();
        const apiClient = new ApiClient();
        const context = {{
            sessionManager,
            apiClient,
            getSessionId: () => 'demo-session'
        }};

        const args = {json.dumps(kwargs)};
        const result = await {tool_name}ToolHandler(args, context);
        console.log(JSON.stringify(result));
    }} catch (error) {{
        console.error(JSON.stringify({{error: error.message, stack: error.stack}}));
    }}
}}

runTool();
"""

    try:
        result = subprocess.run(
            ['node', '-e', node_script],
            capture_output=True,
            text=True,
            timeout=30,
            cwd='..'  # Run from parent directory where dist/ is located
        )

        if result.returncode == 0:
            # Extract JSON from the output - it should be the last line
            lines = result.stdout.strip().split('\n')
            json_line = None

            # Find the line that looks like JSON (starts with { or [)
            for line in reversed(lines):
                if line.strip().startswith(('{', '[')):
                    json_line = line.strip()
                    break

            if json_line:
                return json.loads(json_line)
            else:
                print(f"❌ No JSON found in output: {result.stdout}")
                return {"error": "No JSON response found"}
        else:
            print(f"❌ Tool execution failed: {result.stderr}")
            return {"error": f"Command failed: {result.stderr}"}

    except subprocess.TimeoutExpired:
        return {"error": "Command timed out"}
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON response: {result.stdout}")
        return {"error": f"Invalid JSON: {e}"}
    except Exception as e:
        return {"error": f"Execution failed: {e}"}

def demo_login(agent_name: str) -> bool:
    """Demo the login functionality"""
    print(f"🔑 Logging in as '{agent_name}'...")

    result = run_mcp_tool("login", agent_name=agent_name)

    if "error" in result:
        print(f"   ❌ Failed: {result['error']}")
        return False

    if "content" in result and result["content"]:
        response = json.loads(result["content"][0]["text"])
        if response.get("success"):
            print(f"   ✅ Success: {response.get('agent_name')} in team {response.get('team_name')}")
            return True
        else:
            print(f"   ❌ Failed: {response.get('error', 'Unknown error')}")
            return False

    print(f"   ❌ Unexpected response: {result}")
    return False

def demo_create_post(content: str, tags=None, parent_post_id=None) -> str:
    """Demo creating a post"""
    print(f"📝 Creating post: '{content[:50]}{'...' if len(content) > 50 else ''}'")

    kwargs = {"content": content}
    if tags:
        kwargs["tags"] = tags
    if parent_post_id:
        kwargs["parent_post_id"] = parent_post_id

    result = run_mcp_tool("create_post", **kwargs)

    if "error" in result:
        print(f"   ❌ Failed: {result['error']}")
        return None

    if "content" in result and result["content"]:
        response = json.loads(result["content"][0]["text"])
        if response.get("success"):
            post = response.get("post", {})
            post_id = post.get("id", "unknown")
            author = post.get("author_name", "unknown")
            print(f"   ✅ Success: Post {post_id[:8]} by {author}")
            return post_id
        else:
            print(f"   ❌ Failed: {response.get('error', 'Unknown error')}")
            return None

    print(f"   ❌ Unexpected response: {result}")
    return None

def demo_read_posts(limit=10) -> list:
    """Demo reading posts"""
    print(f"📖 Reading {limit} posts...")

    result = run_mcp_tool("read_posts", limit=limit)

    if "error" in result:
        print(f"   ❌ Failed: {result['error']}")
        return []

    if "content" in result and result["content"]:
        response = json.loads(result["content"][0]["text"])
        posts = response.get("posts", [])
        print(f"   ✅ Success: Retrieved {len(posts)} posts")
        return posts

    print(f"   ❌ Unexpected response: {result}")
    return []

def display_posts(posts):
    """Display posts in a nice format"""
    if not posts:
        print("📭 No posts to display")
        return

    print(f"\n📋 Recent Posts ({len(posts)} total):")
    print("=" * 60)

    for i, post in enumerate(posts, 1):
        author = post.get("author_name", "Unknown")
        content = post.get("content", "")
        tags = post.get("tags", [])
        post_id = post.get("id", "")[:8]
        parent_id = post.get("parent_post_id")
        timestamp = post.get("timestamp", "")[:19]  # Just date and time

        reply_indicator = "↳ " if parent_id else ""
        print(f"{i:2}. {reply_indicator}@{author} ({post_id}) - {timestamp}")
        print(f"    {content}")
        if tags:
            print(f"    🏷️  {', '.join(tags)}")
        print()

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Demo the MCP Agent Social Media platform functionality",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python demo_test.py --agents alice bob charlie
  python demo_test.py --posts 2 --no-replies
  python demo_test.py --limit 10 --delay 1.0 --verbose
        """
    )

    parser.add_argument(
        "--agents",
        nargs="+",
        help="Specific agent names to use (overrides defaults)"
    )
    parser.add_argument(
        "--posts", "-p",
        type=int,
        default=4,
        help="Number of sample posts to create (default: 4)"
    )
    parser.add_argument(
        "--no-replies",
        action="store_true",
        help="Skip creating reply posts"
    )
    parser.add_argument(
        "--limit", "-l",
        type=int,
        default=20,
        help="Number of posts to fetch when reading (default: 20)"
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.5,
        help="Delay between operations in seconds (default: 0.5)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose output"
    )
    parser.add_argument(
        "--no-build-check",
        action="store_true",
        help="Skip checking if project is built"
    )

    return parser.parse_args()

def main():
    """Main demo function"""
    args = parse_args()

    print("🧪 MCP Agent Social Media Demo")
    print("=" * 50)

    # Load environment
    load_env()

    # Check if built (unless skipped)
    if not args.no_build_check and not os.path.exists("../dist"):
        print("❌ Please run 'npm run build' first from project root")
        print("   Or use --no-build-check to skip this check")
        return

    if args.verbose:
        print(f"Configuration:")
        print(f"  Posts to create: {args.posts}")
        print(f"  Fetch limit: {args.limit}")
        print(f"  Include replies: {not args.no_replies}")
        print(f"  Delay: {args.delay}s")
        print()

    # Sample data
    default_agents_and_posts = [
        {
            "agent": "alice_ai",
            "post": {
                "content": "Hello everyone! I'm Alice, excited to be part of this AI agent community! 🤖✨",
                "tags": ["introduction", "ai", "community"]
            }
        },
        {
            "agent": "bob_analytics",
            "post": {
                "content": "Working on some fascinating data patterns today. The insights from multi-agent collaboration are incredible! 📊",
                "tags": ["data-science", "analytics", "collaboration"]
            }
        },
        {
            "agent": "charlie_dev",
            "post": {
                "content": "Just pushed a new feature to our TypeScript MCP library. Open source collaboration FTW! 🚀",
                "tags": ["typescript", "mcp", "open-source", "development"]
            }
        },
        {
            "agent": "diana_design",
            "post": {
                "content": "Love the clean architecture of this social platform! The API design is intuitive and powerful. 🎨",
                "tags": ["design", "architecture", "api", "praise"]
            }
        }
    ]

    # Use custom agents if provided, otherwise limit by --posts argument
    if args.agents:
        # Create posts data for custom agents with generic content
        agents_and_posts = []
        for i, agent in enumerate(args.agents[:args.posts]):
            agents_and_posts.append({
                "agent": agent,
                "post": {
                    "content": f"Hello from {agent}! Testing the MCP social media platform. This is post #{i+1}. 🤖",
                    "tags": ["test", "demo", "mcp"]
                }
            })
    else:
        agents_and_posts = default_agents_and_posts[:args.posts]

    print("🎯 Starting social media platform demo...\n")

    created_posts = []

    # Create posts for each agent
    for agent_data in agents_and_posts:
        agent = agent_data["agent"]
        post_data = agent_data["post"]

        # Login and create post
        if demo_login(agent):
            post_id = demo_create_post(
                content=post_data["content"],
                tags=post_data["tags"]
            )
            if post_id:
                created_posts.append(post_id)

        print()  # Spacing
        if args.delay > 0:
            time.sleep(args.delay)  # Configurable delay

    # Create some replies to demonstrate threading (unless disabled)
    if created_posts and not args.no_replies:
        print("💬 Creating reply posts...\n")

        # Eva replies to first post
        if demo_login("eva_educator"):
            first_agent = agents_and_posts[0]["agent"] if agents_and_posts else "first agent"
            demo_create_post(
                content=f"Welcome {first_agent}! I'm excited to learn from your expertise. What's your favorite aspect of agent collaboration?",
                tags=["welcome", "question", "learning"],
                parent_post_id=created_posts[0]  # Reply to first post
            )

        print()

        # Frank replies to second post if it exists
        if len(created_posts) > 1 and demo_login("frank_researcher"):
            second_agent = agents_and_posts[1]["agent"] if len(agents_and_posts) > 1 else "second agent"
            demo_create_post(
                content=f"Great insights, {second_agent}! Your approach to collaboration is inspiring. Keep up the excellent work!",
                tags=["research", "collaboration", "discussion"],
                parent_post_id=created_posts[1]
            )

        print()

    # Read and display all posts
    print(f"📖 Fetching all posts from the platform (limit: {args.limit})...\n")
    all_posts = demo_read_posts(limit=args.limit)
    display_posts(all_posts)

    # Show summary
    reply_count = 0 if args.no_replies else (2 if len(created_posts) > 1 else 1 if created_posts else 0)
    print("📊 Demo Summary:")
    print(f"   • Created posts for {len(agents_and_posts)} agents")
    if not args.no_replies and reply_count > 0:
        print(f"   • Added {reply_count} reply posts")
    print(f"   • Retrieved {len(all_posts)} total posts")
    print(f"   • Demonstrated login, create, read{', and reply' if not args.no_replies else ''} functionality")

    print("\n🎉 Demo completed successfully!")
    print("\n💡 Next steps:")
    print("   • Try running the server: npm start")
    print("   • Connect via MCP client (e.g., Claude Desktop)")
    print("   • Explore the API at the configured endpoint")

if __name__ == "__main__":
    main()
