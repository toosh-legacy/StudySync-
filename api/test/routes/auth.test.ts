import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { app, db, resetMocks, TEST_USER_ID } from '../helpers/testApp.js';

beforeEach(resetMocks);

function seedKey(raw: string, overrides: Record<string, unknown> = {}) {
  db().seed('api_keys', [
    {
      id: 'k1',
      user_id: TEST_USER_ID,
      key_hash: createHash('sha256').update(raw).digest('hex'),
      plan: 'student',
      revoked: false,
      expires_at: null,
      ...overrides,
    },
  ]);
}

describe('requireAuth middleware', () => {
  it('rejects requests with no credentials', async () => {
    const res = await app.request('/v1/profile');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid JWT', async () => {
    const res = await app.request('/v1/profile', {
      headers: { Authorization: 'Bearer wrong' },
    });
    expect(res.status).toBe(401);
  });

  it('accepts a valid JWT', async () => {
    const res = await app.request('/v1/profile', {
      headers: { Authorization: 'Bearer valid-jwt' },
    });
    expect(res.status).toBe(200);
  });

  it('accepts a valid API key', async () => {
    const raw = 'ss_live_' + 'a'.repeat(40);
    seedKey(raw);
    const res = await app.request('/v1/profile', { headers: { 'X-API-Key': raw } });
    expect(res.status).toBe(200);
  });

  it('rejects a revoked API key', async () => {
    const raw = 'ss_live_' + 'b'.repeat(40);
    seedKey(raw, { revoked: true });
    const res = await app.request('/v1/profile', { headers: { 'X-API-Key': raw } });
    expect(res.status).toBe(401);
  });

  it('rejects an expired API key', async () => {
    const raw = 'ss_live_' + 'c'.repeat(40);
    seedKey(raw, { expires_at: '2000-01-01T00:00:00.000Z' });
    const res = await app.request('/v1/profile', { headers: { 'X-API-Key': raw } });
    expect(res.status).toBe(401);
  });

  it('ignores an API key that is too short', async () => {
    const res = await app.request('/v1/profile', { headers: { 'X-API-Key': 'short' } });
    expect(res.status).toBe(401);
  });
});
