#!/usr/bin/env node

// ABOUTME: Simple CI-friendly MCP server test without mcp-probe timeouts
// ABOUTME: Tests that the server can start and respond to basic MCP initialization

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

// Set test environment
process.env.SOCIALMEDIA_API_BASE_URL = 'https://api.example.com';
process.env.SOCIALMEDIA_API_KEY = 'test-key-for-ci';
process.env.SOCIALMEDIA_TEAM_ID = 'ci-test-team';
process.env.LOG_LEVEL = 'error';

console.log('🔍 Starting CI-friendly MCP server test...');

// Spawn the server process
const serverProcess = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env
});

let initResponse = '';
let serverResponded = false;

// Set a timeout to prevent hanging
const timeout = setTimeout(() => {
  console.log('❌ Server initialization timeout');
  serverProcess.kill('SIGTERM');
  process.exit(1);
}, 30000); // 30 seconds

// Handle server output
serverProcess.stdout.on('data', (data) => {
  initResponse += data.toString();

  try {
    // Try to parse JSON responses
    const lines = initResponse.split('\n');
    for (const line of lines) {
      if (line.trim() && line.startsWith('{')) {
        const response = JSON.parse(line.trim());
        if (response.result && response.result.capabilities) {
          console.log('✅ Server responded with capabilities');
          console.log(`📊 Tools: ${response.result.capabilities.tools ? 'Available' : 'None'}`);
          console.log(`📊 Resources: ${response.result.capabilities.resources ? 'Available' : 'None'}`);
          console.log(`📊 Prompts: ${response.result.capabilities.prompts ? 'Available' : 'None'}`);

          serverResponded = true;
          clearTimeout(timeout);

          // Write a simple report
          const report = {
            timestamp: new Date().toISOString(),
            status: 'PASS',
            server_name: response.result.serverInfo?.name || 'Unknown',
            protocol_version: response.result.protocolVersion,
            capabilities: response.result.capabilities,
            test_type: 'CI Basic Initialization',
            duration_ms: Date.now() - startTime
          };

          writeFileSync('reports/mcp-probe/ci-basic-test.json', JSON.stringify(report, null, 2));
          console.log('✅ CI MCP test completed successfully');

          // Give server time to clean shutdown
          setTimeout(() => {
            serverProcess.kill('SIGTERM');
            setTimeout(() => {
              console.log('✅ Test completed');
              process.exit(0);
            }, 1000);
          }, 500);
        }
      }
    }
  } catch (e) {
    // Ignore JSON parse errors, keep accumulating data
  }
});

serverProcess.stderr.on('data', (data) => {
  console.error(`Server stderr: ${data}`);
});

serverProcess.on('close', (code) => {
  clearTimeout(timeout);
  if (!serverResponded) {
    console.log(`❌ Server process exited with code ${code} without responding`);
    process.exit(1);
  }
});

const startTime = Date.now();

// Send MCP initialization request
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
    clientInfo: {
      name: 'ci-test-client',
      version: '1.0.0'
    }
  }
};

console.log('📤 Sending initialization request...');
serverProcess.stdin.write(JSON.stringify(initRequest) + '\n');
