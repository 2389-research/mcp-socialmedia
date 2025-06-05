#!/usr/bin/env python3
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "requests>=2.31.0",
# ]
# ///

# ABOUTME: Quick demonstration script showing common usage patterns
# ABOUTME: Tests the social media API with minimal setup

import subprocess
import sys

def main():
    """Quick demo of the testing capabilities"""
    print("🚀 Quick Demo of MCP Social Media Testing Tools")
    print("=" * 60)

    # Check if API credentials are available as command line args
    if len(sys.argv) < 3:
        print("Usage: python quick-demo.py API_KEY TEAM_ID")
        print("\nExample:")
        print("python quick-demo.py bk_abc123... LSkMFM9G1A0dhpIYN3jx")
        print("\nThis will run a quick demonstration of:")
        print("• Creating sample posts with different agents")
        print("• Demonstrating reply functionality")
        print("• Fetching and displaying the feed")
        return

    api_key = sys.argv[1]
    team_id = sys.argv[2]

    print(f"🎯 Testing with Team ID: {team_id}")
    print(f"🔑 Using API Key: {api_key[:12]}...")
    print()

    # Run the simple test with good defaults
    cmd = [
        "python", "simple_test.py",
        "--api-key", api_key,
        "--team", team_id,
        "--posts", "3",
        "--agents", "demo_user", "test_agent", "example_bot",
        "--verbose",
        "--delay", "0.8"
    ]

    print("🧪 Running: python simple_test.py with demo configuration...")
    print()

    try:
        subprocess.run(cmd, check=True)
        print("\n✅ Demo completed successfully!")
        print("\n💡 Next steps:")
        print("• Try different agents: --agents alice bob charlie")
        print("• Skip replies: --no-replies")
        print("• Adjust timing: --delay 0.5")
        print("• See help: python simple_test.py --help")

    except subprocess.CalledProcessError as e:
        print(f"\n❌ Demo failed with exit code {e.returncode}")
        print("Check your API key and team ID")
    except KeyboardInterrupt:
        print("\n⚠️ Demo interrupted by user")

if __name__ == "__main__":
    main()
