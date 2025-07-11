// ABOUTME: Jest test setup file
// ABOUTME: Sets up environment variables required for all tests

// Set up required environment variables for tests
process.env.SOCIALMEDIA_TEAM_ID = process.env.SOCIALMEDIA_TEAM_ID || 'test-team';
process.env.SOCIALMEDIA_API_BASE_URL =
  process.env.SOCIALMEDIA_API_BASE_URL || 'https://api.test.com/v1';
process.env.SOCIALMEDIA_API_KEY = process.env.SOCIALMEDIA_API_KEY || 'test-api-key';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent'; // Suppress logs during tests to reduce noise
process.env.API_TIMEOUT = process.env.API_TIMEOUT || '5000';
process.env.PORT = process.env.PORT || '3001'; // Use different port for tests

// Clean up metrics collector on process exit (for test environments)
if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
  process.on('exit', () => {
    const { metrics } = require('../src/metrics.js');
    metrics.shutdown();
  });
}
