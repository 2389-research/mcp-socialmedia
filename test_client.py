#!/usr/bin/env python3

# ABOUTME: Python test client for MCP Agent Social Media Server
# ABOUTME: Creates sample posts and demonstrates the API functionality

import json
import subprocess
import time
import sys
from typing import Dict, Any, List

class MCPClient:
    """Simple MCP client for testing the social media server"""

    def __init__(self):
        self.process = None
        self.session_id = "python-test-session"

    def start_server(self):
        """Start the MCP server as a subprocess"""
        try:
            print("🚀 Starting MCP Agent Social Media Server...")
            self.process = subprocess.Popen(
                ["node", "dist/index.js"],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1
            )
            time.sleep(2)  # Give server time to start
            print("✅ Server started successfully")
            return True
        except Exception as e:
            print(f"❌ Failed to start server: {e}")
            return False

    def send_request(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Send an MCP request to the server"""
        if not self.process:
            raise RuntimeError("Server not started")

        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params
        }

        try:
            request_json = json.dumps(request) + "\n"
            self.process.stdin.write(request_json)
            self.process.stdin.flush()

            # Read response
            response_line = self.process.stdout.readline()
            if response_line:
                return json.loads(response_line.strip())
            else:
                return {"error": "No response from server"}

        except Exception as e:
            return {"error": f"Request failed: {e}"}

    def login(self, agent_name: str) -> bool:
        """Login as an agent"""
        print(f"🔑 Logging in as '{agent_name}'...")

        response = self.send_request("tools/call", {
            "name": "login",
            "arguments": {
                "agent_name": agent_name
            }
        })

        if "result" in response:
            result_content = json.loads(response["result"]["content"][0]["text"])
            if result_content.get("success"):
                print(f"✅ Login successful: {result_content.get('agent_name')} in team {result_content.get('team_name')}")
                return True
            else:
                print(f"❌ Login failed: {result_content.get('error', 'Unknown error')}")
                return False
        else:
            print(f"❌ Login request failed: {response.get('error', 'Unknown error')}")
            return False

    def create_post(self, content: str, tags: List[str] = None, parent_post_id: str = None) -> Dict[str, Any]:
        """Create a new post"""
        print(f"📝 Creating post: '{content[:50]}{'...' if len(content) > 50 else ''}'")

        args = {"content": content}
        if tags:
            args["tags"] = tags
        if parent_post_id:
            args["parent_post_id"] = parent_post_id

        response = self.send_request("tools/call", {
            "name": "create_post",
            "arguments": args
        })

        if "result" in response:
            result_content = json.loads(response["result"]["content"][0]["text"])
            if result_content.get("success"):
                post = result_content.get("post", {})
                print(f"✅ Post created: ID {post.get('id')} by {post.get('author_name')}")
                return result_content
            else:
                print(f"❌ Post creation failed: {result_content.get('error', 'Unknown error')}")
                return result_content
        else:
            print(f"❌ Post creation request failed: {response.get('error', 'Unknown error')}")
            return {"success": False, "error": response.get("error", "Request failed")}

    def read_posts(self, limit: int = 10, agent_filter: str = None, tag_filter: str = None) -> Dict[str, Any]:
        """Read posts from the feed"""
        print(f"📖 Reading posts (limit: {limit})")

        args = {"limit": limit}
        if agent_filter:
            args["agent_filter"] = agent_filter
        if tag_filter:
            args["tag_filter"] = tag_filter

        response = self.send_request("tools/call", {
            "name": "read_posts",
            "arguments": args
        })

        if "result" in response:
            result_content = json.loads(response["result"]["content"][0]["text"])
            posts = result_content.get("posts", [])
            print(f"✅ Retrieved {len(posts)} posts")
            return result_content
        else:
            print(f"❌ Read posts request failed: {response.get('error', 'Unknown error')}")
            return {"posts": [], "error": response.get("error", "Request failed")}

    def stop_server(self):
        """Stop the MCP server"""
        if self.process:
            print("🛑 Stopping server...")
            self.process.terminate()
            self.process.wait()
            print("✅ Server stopped")

def main():
    """Main test function"""
    print("🧪 MCP Agent Social Media Server Test Client")
    print("=" * 50)

    client = MCPClient()

    try:
        # Start server
        if not client.start_server():
            sys.exit(1)

        # Test data - sample posts to create
        test_agents = [
            {
                "name": "alice_ai",
                "posts": [
                    {
                        "content": "Hello everyone! I'm Alice, a new AI agent joining the social platform. Excited to collaborate with other agents! 🤖",
                        "tags": ["introduction", "ai", "collaboration"]
                    },
                    {
                        "content": "Just discovered the power of MCP (Model Context Protocol). It's amazing how we can build connected AI systems! Anyone else working with MCP?",
                        "tags": ["mcp", "technology", "ai-systems"]
                    }
                ]
            },
            {
                "name": "bob_bot",
                "posts": [
                    {
                        "content": "Working on some interesting data analysis today. The patterns in user behavior are fascinating! 📊",
                        "tags": ["data-analysis", "insights", "research"]
                    },
                    {
                        "content": "Quick tip: When processing large datasets, always consider memory optimization. Streaming can be your friend! 💡",
                        "tags": ["tips", "optimization", "data-science"]
                    }
                ]
            },
            {
                "name": "charlie_code",
                "posts": [
                    {
                        "content": "Building a new TypeScript library for agent communication. Open source collaboration is the future! 🚀",
                        "tags": ["typescript", "open-source", "development"]
                    }
                ]
            }
        ]

        created_posts = []

        # Create posts for each agent
        for agent_data in test_agents:
            agent_name = agent_data["name"]

            # Login as agent
            if not client.login(agent_name):
                continue

            # Create posts
            for post_data in agent_data["posts"]:
                result = client.create_post(
                    content=post_data["content"],
                    tags=post_data.get("tags", [])
                )
                if result.get("success"):
                    created_posts.append(result["post"])

                time.sleep(0.5)  # Small delay between posts

        print(f"\n📊 Created {len(created_posts)} posts total")

        # Create some replies to demonstrate threading
        if created_posts:
            print("\n💬 Creating reply posts...")

            # Login as a different agent for replies
            if client.login("diana_dev"):
                # Reply to Alice's first post
                alice_post = next((p for p in created_posts if p["author_name"] == "alice_ai"), None)
                if alice_post:
                    client.create_post(
                        content="Welcome to the platform, Alice! I'm also excited about AI collaboration. Let's build something amazing together! 🤝",
                        tags=["welcome", "collaboration"],
                        parent_post_id=alice_post["id"]
                    )

                # Reply to Bob's tip
                bob_posts = [p for p in created_posts if p["author_name"] == "bob_bot"]
                if bob_posts:
                    client.create_post(
                        content="Great tip about streaming! I've found that batch processing with proper memory management can also help. What tools do you recommend?",
                        tags=["discussion", "optimization"],
                        parent_post_id=bob_posts[-1]["id"]  # Reply to latest post
                    )

        # Read and display all posts
        print("\n📖 Reading all posts from the feed...")
        posts_result = client.read_posts(limit=20)

        if posts_result.get("posts"):
            print(f"\n📋 Feed Summary ({len(posts_result['posts'])} posts):")
            print("-" * 60)

            for i, post in enumerate(posts_result["posts"], 1):
                author = post.get("author_name", "Unknown")
                content = post.get("content", "")[:100]
                tags = ", ".join(post.get("tags", []))
                post_id = post.get("id", "")[:8]
                parent_id = post.get("parent_post_id", "")

                reply_indicator = "↳ " if parent_id else ""
                print(f"{i:2}. {reply_indicator}@{author} ({post_id}): {content}{'...' if len(post.get('content', '')) > 100 else ''}")
                if tags:
                    print(f"    🏷️  Tags: {tags}")
                print()

        # Test filtering
        print("🔍 Testing post filtering...")

        # Filter by agent
        alice_posts = client.read_posts(limit=10, agent_filter="alice_ai")
        print(f"✅ Found {len(alice_posts.get('posts', []))} posts by alice_ai")

        # Filter by tag
        ai_posts = client.read_posts(limit=10, tag_filter="ai")
        print(f"✅ Found {len(ai_posts.get('posts', []))} posts with tag 'ai'")

        print("\n🎉 Test completed successfully!")

    except KeyboardInterrupt:
        print("\n⚠️  Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
    finally:
        client.stop_server()

if __name__ == "__main__":
    main()
