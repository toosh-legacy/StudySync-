import { describe, it, expect, beforeEach } from 'vitest';
import { app, resetMocks, setApiRateLimit, auth } from '../helpers/testApp.js';

beforeEach(resetMocks);

describe('security + rate limiting', () => {
  it('sets security headers on responses', async () => {
    const res = await app.request('/v1/healthz');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('rejects requests when the per-IP limiter is exhausted', async () => {
    setApiRateLimit(false);
    const res = await app.request('/v1/healthz');
    expect(res.status).toBe(429);
    expect((await (res.json() as Promise<any>)).error).toBe('RATE_LIMITED');
  });

  it('still serves normally when under the limit', async () => {
    const res = await app.request('/v1/profile', { headers: auth() });
    expect(res.status).toBe(200);
  });
});
