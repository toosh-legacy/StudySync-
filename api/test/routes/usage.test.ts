import { describe, it, expect, beforeEach } from 'vitest';
import { app, db, resetMocks, auth, TEST_USER_ID } from '../helpers/testApp.js';

beforeEach(resetMocks);

describe('GET /v1/usage', () => {
  it('aggregates token usage and cost per day', async () => {
    const today = new Date().toISOString();
    db().seed('generated_outputs', [
      { id: 'o1', user_id: TEST_USER_ID, prompt_tokens: 1000, completion_tokens: 500, model_used: 'gpt-4o-mini', cache_hit: false, created_at: today },
      { id: 'o2', user_id: TEST_USER_ID, prompt_tokens: 2000, completion_tokens: 1000, model_used: 'gpt-4o-mini', cache_hit: false, created_at: today },
      { id: 'o3', user_id: TEST_USER_ID, prompt_tokens: 0, completion_tokens: 0, model_used: 'gpt-4o-mini', cache_hit: true, created_at: today },
    ]);
    const res = await app.request('/v1/usage', { headers: auth() });
    expect(res.status).toBe(200);
    const body = await (res.json() as Promise<any>);
    expect(body.totals.generations).toBe(3);
    expect(body.totals.cache_hits).toBe(1);
    expect(body.totals.total_tokens).toBe(4500);
    expect(body.totals.estimated_cost_usd).toBeGreaterThan(0);
    expect(body.daily).toHaveLength(1);
  });

  it('returns empty totals when there is no usage', async () => {
    const res = await app.request('/v1/usage', { headers: auth() });
    const body = await (res.json() as Promise<any>);
    expect(body.totals.generations).toBe(0);
    expect(body.daily).toHaveLength(0);
  });

  it('rejects an out-of-range days param', async () => {
    const res = await app.request('/v1/usage?days=0', { headers: auth() });
    expect(res.status).toBe(422);
  });
});
