import { config, validateConfig } from './config.js';
import app from './app.js';
import { startJobs } from './jobs/runner.js';

// Validate environment
try {
  validateConfig();
} catch (err) {
  console.error('[Cortex] Configuration error:', (err as Error).message);
  console.error('[Cortex] Please check your .env file');
  process.exit(1);
}

// Start server
app.listen(config.port, () => {
  console.log(`[Cortex] Server running on port ${config.port}`);
  console.log(`[Cortex] Health check: http://localhost:${config.port}/health`);
});

// Start background jobs
startJobs();
