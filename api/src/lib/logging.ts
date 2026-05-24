import { randomUUID } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
  }
}

/**
 * Assigns/propagates a request id (X-Request-Id) and emits one structured JSON
 * log line per request. Structured logs are scrapeable by any aggregator; the
 * request id ties a client report to a server log. If OTEL_EXPORTER_OTLP_ENDPOINT
 * is configured, this is the natural place to also start a span (left as a seam
 * to avoid pulling the OpenTelemetry SDK when no collector is present).
 */
export const requestLogger: MiddlewareHandler = async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-Id', requestId);

  const start = Date.now();
  await next();
  const ms = Date.now() - start;

  const status = c.res.status;
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
      request_id: requestId,
      method: c.req.method,
      path: c.req.path,
      status,
      ms,
    }),
  );
};
