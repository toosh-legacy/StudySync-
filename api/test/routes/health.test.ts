import { describe, it, expect } from 'vitest';
import { app } from '../helpers/testApp.js';

describe('GET /v1/healthz', () => {
  it('returns ok without auth', async () => {
    const res = await app.request('/v1/healthz');
    expect(res.status).toBe(200);
    expect(await (res.json() as Promise<any>)).toEqual({
      ok: true,
      service: 'studysync-api',
      version: '0.1.0',
    });
  });
});

describe('unknown routes', () => {
  it('returns a 404 NOT_FOUND payload', async () => {
    const res = await app.request('/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect((await (res.json() as Promise<any>)).error).toBe('NOT_FOUND');
  });
});
