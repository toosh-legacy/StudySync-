import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { app, db, resetMocks, auth, jsonReq, TEST_USER_ID } from '../helpers/testApp.js';

beforeEach(resetMocks);

const KID = '44444444-4444-4444-4444-444444444444';

describe('api keys', () => {
  it('lists keys', async () => {
    db().seed('api_keys', [
      { id: KID, user_id: TEST_USER_ID, label: 'CI', key_prefix: 'ss_live_x', plan: 'free', revoked: false, created_at: '2026-01-01T00:00:00.000Z' },
    ]);
    const res = await app.request('/v1/keys', { headers: auth() });
    expect(res.status).toBe(200);
    expect((await (res.json() as Promise<any>))).toHaveLength(1);
  });

  it('creates a key and returns the raw secret once', async () => {
    const res = await app.request('/v1/keys', jsonReq('POST', { label: 'My key' }));
    expect(res.status).toBe(201);
    const body = await (res.json() as Promise<any>);
    expect(body.key).toMatch(/^ss_live_[0-9a-f]{64}$/);
    expect(body.warning).toContain('only time');
  });

  it('forbids API-key callers from minting keys', async () => {
    const raw = 'ss_live_' + 'd'.repeat(40);
    db().seed('api_keys', [
      { id: KID, user_id: TEST_USER_ID, key_hash: createHash('sha256').update(raw).digest('hex'), plan: 'free', revoked: false, expires_at: null },
    ]);
    const res = await app.request('/v1/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': raw },
      body: JSON.stringify({ label: 'nope' }),
    });
    expect(res.status).toBe(403);
  });

  it('revokes a key', async () => {
    db().seed('api_keys', [
      { id: KID, user_id: TEST_USER_ID, label: 'CI', revoked: false },
    ]);
    const res = await app.request(`/v1/keys/${KID}`, { method: 'DELETE', headers: auth() });
    expect(res.status).toBe(204);
    expect(db().get('api_keys')[0].revoked).toBe(true);
  });

  it('404s when revoking a missing key', async () => {
    const res = await app.request(`/v1/keys/${KID}`, { method: 'DELETE', headers: auth() });
    expect(res.status).toBe(404);
  });
});
