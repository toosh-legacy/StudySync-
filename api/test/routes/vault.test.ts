import { describe, it, expect, beforeEach } from 'vitest';
import { app, db, resetMocks, auth, jsonReq, TEST_USER_ID } from '../helpers/testApp.js';

beforeEach(resetMocks);

const OID = '55555555-5555-5555-5555-555555555555';
const CID = '33333333-3333-3333-3333-333333333333';

function seedOutput(overrides: Record<string, unknown> = {}) {
  db().seed('generated_outputs', [
    {
      id: OID,
      user_id: TEST_USER_ID,
      course_id: CID,
      output_format: 'summary',
      depth: 'standard',
      sources_used_count: 1,
      prompt_tokens: 100,
      completion_tokens: 50,
      cache_hit: false,
      public_share: false,
      output: { headline: 'Hi' },
      created_at: '2026-01-01T00:00:00.000Z',
      ...overrides,
    },
  ]);
}

describe('vault', () => {
  it('lists outputs with a preview and pagination metadata', async () => {
    seedOutput();
    const res = await app.request('/v1/vault?limit=10&offset=0', { headers: auth() });
    expect(res.status).toBe(200);
    const body = await (res.json() as Promise<any>);
    expect(body.items[0].preview).toContain('headline');
    expect(body.items[0].output).toBeUndefined();
    expect(body.limit).toBe(10);
  });

  it('filters by output_format', async () => {
    seedOutput();
    const res = await app.request('/v1/vault?output_format=flashcards', { headers: auth() });
    expect((await (res.json() as Promise<any>)).items).toHaveLength(0);
  });

  it('rejects an invalid limit', async () => {
    const res = await app.request('/v1/vault?limit=999', { headers: auth() });
    expect(res.status).toBe(422);
  });

  it('gets a single output', async () => {
    seedOutput();
    const res = await app.request(`/v1/vault/${OID}`, { headers: auth() });
    expect(res.status).toBe(200);
    expect((await (res.json() as Promise<any>)).id).toBe(OID);
  });

  it('404s for a missing output', async () => {
    const res = await app.request(`/v1/vault/${OID}`, { headers: auth() });
    expect(res.status).toBe(404);
  });

  it('deletes an output', async () => {
    seedOutput();
    const res = await app.request(`/v1/vault/${OID}`, { method: 'DELETE', headers: auth() });
    expect(res.status).toBe(204);
  });

  it('toggles public sharing and returns a share url', async () => {
    seedOutput();
    const res = await app.request(`/v1/vault/${OID}/share`, jsonReq('PATCH', { public_share: true }));
    expect(res.status).toBe(200);
    const body = await (res.json() as Promise<any>);
    expect(body.public_share).toBe(true);
    expect(body.share_url).toBe(`/share/${OID}`);
  });

  it('returns a null share url when disabling sharing', async () => {
    seedOutput({ public_share: true });
    const res = await app.request(`/v1/vault/${OID}/share`, jsonReq('PATCH', { public_share: false }));
    expect((await (res.json() as Promise<any>)).share_url).toBeNull();
  });
});
