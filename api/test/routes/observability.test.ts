import { describe, it, expect, beforeEach } from 'vitest';
import { app, db, resetMocks } from '../helpers/testApp.js';

beforeEach(resetMocks);

describe('observability + docs', () => {
  it('returns and propagates a request id', async () => {
    const res = await app.request('/v1/healthz');
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });

  it('echoes a provided request id', async () => {
    const res = await app.request('/v1/healthz', { headers: { 'x-request-id': 'abc-123' } });
    expect(res.headers.get('x-request-id')).toBe('abc-123');
  });

  it('readiness probe reports healthy when the database is reachable', async () => {
    const res = await app.request('/v1/healthz/ready');
    expect(res.status).toBe(200);
    const body = await (res.json() as Promise<any>);
    expect(body.ok).toBe(true);
    expect(body.checks.database).toBe(true);
  });

  it('readiness probe returns 503 when the database errors', async () => {
    db().failTable('profiles');
    const res = await app.request('/v1/healthz/ready');
    expect(res.status).toBe(503);
    expect((await (res.json() as Promise<any>)).ok).toBe(false);
  });

  it('serves Swagger UI at /v1/meta/docs', async () => {
    const res = await app.request('/v1/meta/docs');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('swagger-ui');
  });
});
