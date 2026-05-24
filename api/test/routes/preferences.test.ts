import { describe, it, expect, beforeEach } from 'vitest';
import { app, db, resetMocks, auth, jsonReq, TEST_USER_ID } from '../helpers/testApp.js';

beforeEach(resetMocks);

describe('preferences', () => {
  it('returns {} when no preferences row exists', async () => {
    const res = await app.request('/v1/preferences', { headers: auth() });
    expect(res.status).toBe(200);
    expect(await (res.json() as Promise<any>)).toEqual({});
  });

  it('updates an existing preferences row', async () => {
    db().seed('user_preferences', [
      {
        user_id: TEST_USER_ID,
        default_format: 'summary',
        default_depth: 'standard',
        auto_scan_page: false,
        cache_outputs: true,
        spaced_repetition: false,
      },
    ]);
    const res = await app.request(
      '/v1/preferences',
      jsonReq('PATCH', { default_format: 'notes', auto_scan_page: true }),
    );
    expect(res.status).toBe(200);
    const body = await (res.json() as Promise<any>);
    expect(body.default_format).toBe('notes');
    expect(body.auto_scan_page).toBe(true);
  });

  it('rejects an empty patch body', async () => {
    const res = await app.request('/v1/preferences', jsonReq('PATCH', {}));
    expect(res.status).toBe(422);
  });
});
