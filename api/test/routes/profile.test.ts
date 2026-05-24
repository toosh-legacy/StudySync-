import { describe, it, expect, beforeEach } from 'vitest';
import { app, db, resetMocks, auth } from '../helpers/testApp.js';

beforeEach(resetMocks);

describe('GET /v1/profile', () => {
  it('returns the profile for the authenticated user', async () => {
    const res = await app.request('/v1/profile', { headers: auth() });
    expect(res.status).toBe(200);
    const body = await (res.json() as Promise<any>);
    expect(body.plan).toBe('free');
  });

  it('returns 404 when no profile row exists', async () => {
    db().tables.set('profiles', []);
    const res = await app.request('/v1/profile', { headers: auth() });
    expect(res.status).toBe(404);
  });

  it('returns 500 on a database error', async () => {
    db().failTable('profiles');
    const res = await app.request('/v1/profile', { headers: auth() });
    expect(res.status).toBe(500);
  });
});
