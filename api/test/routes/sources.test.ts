import { describe, it, expect, beforeEach } from 'vitest';
import { app, db, resetMocks, jsonReq, TEST_USER_ID } from '../helpers/testApp.js';

beforeEach(resetMocks);

const CID = '33333333-3333-3333-3333-333333333333';

function seedCourse() {
  db().seed('courses', [{ id: CID, user_id: TEST_USER_ID, name: 'Bio' }]);
}

describe('POST /v1/sources/collect', () => {
  it('404s when the course is missing', async () => {
    const res = await app.request(
      '/v1/sources/collect',
      jsonReq('POST', { course_id: CID, providers: [] }),
    );
    expect(res.status).toBe(404);
  });

  it('skips disconnected providers and 422s with no content', async () => {
    seedCourse();
    const res = await app.request(
      '/v1/sources/collect',
      jsonReq('POST', { course_id: CID, providers: ['notion'] }),
    );
    expect(res.status).toBe(422);
    const body = await (res.json() as Promise<any>);
    expect(body.error).toBe('NO_CONTENT');
    expect(body.skipped[0]).toEqual({ provider: 'notion', reason: 'Provider not connected' });
  });

  it('collects current page content', async () => {
    seedCourse();
    const res = await app.request(
      '/v1/sources/collect',
      jsonReq('POST', {
        course_id: CID,
        providers: [],
        current_page_content: 'Some page text',
        current_page_title: 'My Page',
      }),
    );
    expect(res.status).toBe(200);
    const body = await (res.json() as Promise<any>);
    expect(body.collected).toHaveLength(1);
    expect(body.collected[0].provider).toBe('current_page');
    expect(body.total_characters).toBe('Some page text'.length);
  });

  it('collects from a connected obsidian vault and caches it', async () => {
    seedCourse();
    db().seed('source_connections', [
      {
        id: 'sc1',
        user_id: TEST_USER_ID,
        provider: 'obsidian',
        connected: true,
        metadata: { vault_content: 'My obsidian notes about cells.' },
      },
    ]);
    const res = await app.request(
      '/v1/sources/collect',
      jsonReq('POST', { course_id: CID, providers: ['obsidian'] }),
    );
    expect(res.status).toBe(200);
    const body = await (res.json() as Promise<any>);
    expect(body.collected[0].provider).toBe('obsidian');
    expect(db().get('source_cache')).toHaveLength(1);
  });
});
