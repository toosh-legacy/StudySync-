import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { apiError, ErrorCode } from './lib/errors.js';
import { sendError } from './lib/http.js';
import { healthRouter } from './routes/health.js';
import { profileRouter } from './routes/profile.js';
import { coursesRouter } from './routes/courses.js';
import { preferencesRouter } from './routes/preferences.js';
import { keysRouter } from './routes/keys.js';
import { vaultRouter } from './routes/vault.js';
import { sharesRouter } from './routes/shares.js';
import { connectionsRouter } from './routes/connections.js';
import { sourcesRouter } from './routes/sources.js';
import { generateRouter } from './routes/generate.js';
import { dashboardRouter } from './routes/dashboard.js';

const app = new Hono();

app.use('*', logger());

app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return origin;
      if (origin === (process.env.WEB_APP_URL ?? 'http://localhost:3000')) {
        return origin;
      }
      if (origin.startsWith('chrome-extension://')) return origin;
      // Allow any localhost port during local dev for convenience.
      if (/^http:\/\/localhost:\d+$/.test(origin)) return origin;
      return null;
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'X-API-Key', 'Content-Type'],
    credentials: false,
    maxAge: 600,
  }),
);

app.route('/v1/healthz', healthRouter);
app.route('/v1/profile', profileRouter);
app.route('/v1/courses', coursesRouter);
app.route('/v1/preferences', preferencesRouter);
app.route('/v1/keys', keysRouter);
app.route('/v1/vault', vaultRouter);
app.route('/v1/shares', sharesRouter);
app.route('/v1/connections', connectionsRouter);
app.route('/v1/sources', sourcesRouter);
app.route('/v1/generate', generateRouter);
app.route('/v1/dashboard', dashboardRouter);

app.notFound((c) =>
  sendError(c, apiError(ErrorCode.NOT_FOUND, 'Route not found', 404)),
);

app.onError((err, c) => {
  console.error('[api]', err);
  return sendError(
    c,
    apiError(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500),
  );
});

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[api] StudySync API listening on http://localhost:${info.port}`);
});
