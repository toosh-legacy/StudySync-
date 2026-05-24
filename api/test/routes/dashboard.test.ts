import { describe, it, expect, beforeEach } from 'vitest';
import { app, db, resetMocks, auth, TEST_USER_ID } from '../helpers/testApp.js';

beforeEach(resetMocks);

describe('GET /v1/dashboard/stats', () => {
  it('aggregates counts and today\'s token usage', async () => {
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    db().seed('generated_outputs', [
      { id: 'g1', user_id: TEST_USER_ID, created_at: now },
      { id: 'g2', user_id: TEST_USER_ID, created_at: now },
    ]);
    db().seed('courses', [
      { id: 'c1', user_id: TEST_USER_ID, archived: false },
      { id: 'c2', user_id: TEST_USER_ID, archived: true },
    ]);
    db().seed('source_connections', [
      { id: 's1', user_id: TEST_USER_ID, connected: true },
      { id: 's2', user_id: TEST_USER_ID, connected: false },
    ]);
    db().seed('token_usage', [
      { user_id: TEST_USER_ID, date: today, tokens_used: 4242 },
    ]);

    const res = await app.request('/v1/dashboard/stats', { headers: auth() });
    expect(res.status).toBe(200);
    const body = await (res.json() as Promise<any>);
    expect(body.generations_this_month).toBe(2);
    expect(body.courses).toBe(1);
    expect(body.connected_sources).toBe(1);
    expect(body.tokens_used_today).toBe(4242);
  });

  it('returns zeros when there is no data', async () => {
    const res = await app.request('/v1/dashboard/stats', { headers: auth() });
    const body = await (res.json() as Promise<any>);
    expect(body).toEqual({
      generations_this_month: 0,
      courses: 0,
      connected_sources: 0,
      tokens_used_today: 0,
    });
  });
});
