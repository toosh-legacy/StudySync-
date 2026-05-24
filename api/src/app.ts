import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { bodyLimit } from 'hono/body-limit';
import { requestLogger } from './lib/logging.js';
import { apiError, ErrorCode } from './lib/errors.js';
import { sendError } from './lib/http.js';
import { apiLimiter } from './lib/ratelimit.js';
import { healthRouter } from './routes/health.js';
import { profileRouter } from './routes/profile.js';
import { coursesRouter } from './routes/courses.js';
import { preferencesRouter } from './routes/preferences.js';
import { keysRouter } from './routes/keys.js';
import { vaultRouter } from './routes/vault.js';
import { sharesRouter } from './routes/shares.js';
import { connectionsRouter } from './routes/connections.js';
import { sourcesRouter } from './routes/sources.js';
import { generateRouter, jobProcessHandler } from './routes/generate.js';
import { JOB_PROCESS_PATH } from './lib/queue.js';
import { dashboardRouter } from './routes/dashboard.js';
import { usageRouter } from './routes/usage.js';
import { metaRouter, openapiHandler } from './routes/meta.js';

/**
 * Build the StudySync API app. Kept separate from server startup so tests and the
 * live smoke script can drive it in-process via `app.request(...)`.
 */
export function createApp(): Hono {
  const app = new Hono();

  app.use('*', requestLogger);
  app.use('*', secureHeaders());

  // Cap request bodies (~5 MB) — generous given the 300k-char source limit, but
  // protects against oversized payloads before any parsing work.
  app.use(
    '*',
    bodyLimit({
      maxSize: 5 * 1024 * 1024,
      onError: (c) =>
        sendError(c, apiError(ErrorCode.VALIDATION_ERROR, 'Request body too large', 413)),
    }),
  );

  // Coarse per-IP rate limit across the whole API (fails open if Upstash absent).
  app.use('*', async (c, next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      'anonymous';
    const result = await apiLimiter.limit(`api:${ip}`);
    if (!result.success) {
      return sendError(
        c,
        apiError(ErrorCode.RATE_LIMITED, 'Too many requests. Please slow down.', 429),
      );
    }
    await next();
  });

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
  // Internal QStash delivery endpoint (verified by signature, not auth).
  app.post(JOB_PROCESS_PATH, jobProcessHandler);
  app.route('/v1/dashboard', dashboardRouter);
  app.route('/v1/usage', usageRouter);
  app.route('/v1/meta', metaRouter);
  // Conventionally served at the root for discovery tools.
  app.get('/v1/openapi.json', openapiHandler);

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

  return app;
}
