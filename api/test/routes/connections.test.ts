import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { app, db, resetMocks, auth, jsonReq, TEST_USER_ID } from '../helpers/testApp.js';

beforeEach(resetMocks);
afterEach(() => vi.restoreAllMocks());

function mockFetch(impl: (url: string) => { ok: boolean; json?: () => Promise<any>; text?: () => Promise<string> }) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) =>
    Promise.resolve(impl(String(input)) as unknown as Response),
  );
}

describe('connections', () => {
  it('lists all five providers, defaulting to disconnected', async () => {
    const res = await app.request('/v1/connections', { headers: auth() });
    expect(res.status).toBe(200);
    const body = await (res.json() as Promise<any>);
    expect(body).toHaveLength(5);
    expect(body.every((p: any) => p.connected === false)).toBe(true);
  });

  it('returns a Google OAuth redirect url', async () => {
    const res = await app.request('/v1/connections/google_drive', jsonReq('POST', {}));
    expect(res.status).toBe(200);
    expect((await (res.json() as Promise<any>)).redirect_url).toContain('accounts.google.com');
  });

  it('returns a Notion OAuth redirect url', async () => {
    const res = await app.request('/v1/connections/notion', jsonReq('POST', {}));
    expect(res.status).toBe(200);
    expect((await (res.json() as Promise<any>)).redirect_url).toContain('notion.com');
  });

  it('connects Canvas when the probe succeeds', async () => {
    mockFetch(() => ({ ok: true, json: async () => ({ name: 'Stu', id: 7 }) }));
    const res = await app.request(
      '/v1/connections/canvas',
      jsonReq('POST', { canvas_url: 'https://canvas.test/', api_token: 'token123456' }),
    );
    expect(res.status).toBe(200);
    expect((await (res.json() as Promise<any>)).ok).toBe(true);
    expect(db().get('source_connections')[0].provider).toBe('canvas');
  });

  it('422s when the Canvas probe fails', async () => {
    mockFetch(() => ({ ok: false }));
    const res = await app.request(
      '/v1/connections/canvas',
      jsonReq('POST', { canvas_url: 'https://canvas.test', api_token: 'token123456' }),
    );
    expect(res.status).toBe(422);
  });

  it('422s when Moodle returns an exception', async () => {
    mockFetch(() => ({ ok: true, json: async () => ({ exception: 'invalidtoken', message: 'bad token' }) }));
    const res = await app.request(
      '/v1/connections/moodle',
      jsonReq('POST', { moodle_url: 'https://moodle.test', web_service_token: 'token123456' }),
    );
    expect(res.status).toBe(422);
  });

  it('connects an Obsidian vault', async () => {
    const res = await app.request(
      '/v1/connections/obsidian',
      jsonReq('POST', { content: 'my vault notes' }),
    );
    expect(res.status).toBe(200);
    expect(db().get('source_connections')[0].detail_label).toContain('characters');
  });

  it('disconnects a provider', async () => {
    db().seed('source_connections', [
      { id: 'sc1', user_id: TEST_USER_ID, provider: 'canvas', connected: true, access_token: 'x' },
    ]);
    const res = await app.request('/v1/connections/canvas/disconnect', {
      method: 'DELETE',
      headers: auth(),
    });
    expect(res.status).toBe(204);
    expect(db().get('source_connections')[0].connected).toBe(false);
  });

  it('404s for an unknown provider', async () => {
    const res = await app.request('/v1/connections/dropbox', jsonReq('POST', {}));
    expect(res.status).toBe(404);
  });

  it('redirects with an error on an invalid OAuth callback state', async () => {
    const res = await app.request('/v1/connections/google_drive/callback?code=abc&state=bad');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('status=error');
  });

  it('redirects with an error for an unknown callback provider', async () => {
    const res = await app.request('/v1/connections/canvas/callback?code=abc&state=bad');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('status=error');
  });
});
