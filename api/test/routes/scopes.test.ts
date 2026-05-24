import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { app, db, resetMocks, auth, TEST_USER_ID } from '../helpers/testApp.js';

beforeEach(resetMocks);

const CID = '33333333-3333-3333-3333-333333333333';

function seedCourse() {
  db().seed('courses', [{ id: CID, user_id: TEST_USER_ID, name: 'Bio 101' }]);
}
function seedKey(raw: string, overrides: Record<string, unknown> = {}) {
  db().seed('api_keys', [
    {
      id: 'key-1',
      user_id: TEST_USER_ID,
      key_hash: createHash('sha256').update(raw).digest('hex'),
      plan: 'developer',
      revoked: false,
      expires_at: null,
      scopes: ['generate:read', 'generate:write'],
      ...overrides,
    },
  ]);
}
function genBody() {
  return {
    course_id: CID,
    output_format: 'summary',
    sources: [{ provider: 'notion', source_name: 'A', content: 'content' }],
  };
}
function keyReq(raw: string, body: unknown) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': raw },
    body: JSON.stringify(body),
  };
}

describe('per-key scopes', () => {
  it('forbids generation with a read-only key', async () => {
    seedCourse();
    const raw = 'ss_live_' + 'r'.repeat(40);
    seedKey(raw, { scopes: ['generate:read'] });
    const res = await app.request('/v1/generate', keyReq(raw, genBody()));
    expect(res.status).toBe(403);
  });

  it('allows generation with a read+write key', async () => {
    seedCourse();
    const raw = 'ss_live_' + 'w'.repeat(40);
    seedKey(raw, { scopes: ['generate:read', 'generate:write'] });
    const res = await app.request('/v1/generate', keyReq(raw, genBody()));
    expect(res.status).toBe(200);
  });
});

describe('per-key daily token quota', () => {
  it('429s when the per-key quota is already consumed', async () => {
    seedCourse();
    const raw = 'ss_live_' + 'q'.repeat(40);
    seedKey(raw, { daily_token_quota: 100 });
    db().seed('token_usage', [
      { user_id: TEST_USER_ID, date: new Date().toISOString().slice(0, 10), tokens_used: 500 },
    ]);
    const res = await app.request('/v1/generate', keyReq(raw, genBody()));
    expect(res.status).toBe(429);
    expect((await (res.json() as Promise<any>)).error).toBe('BUDGET_EXHAUSTED');
    expect(res.headers.get('retry-after')).toBeTruthy();
  });
});
