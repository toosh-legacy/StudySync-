import 'dotenv/config';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { assertEnv } from './lib/env.js';

assertEnv();

const app = createApp();
const port = Number(process.env.PORT ?? 3001);

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[api] StudySync API listening on http://localhost:${info.port}`);
});

// Graceful shutdown so in-flight requests can finish on deploy/restart.
function shutdown(signal: string) {
  console.log(`[api] ${signal} received, shutting down...`);
  server.close(() => process.exit(0));
  // Force-exit if connections don't drain promptly.
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
