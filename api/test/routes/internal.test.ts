import { describe, it, expect, beforeEach } from 'vitest';
import { app, resetMocks } from '../helpers/testApp.js';

beforeEach(resetMocks);

describe('POST /v1/internal/generation-jobs/process', () => {
  it('rejects delivery without a valid QStash signature (401)', async () => {
    const res = await app.request('/v1/internal/generation-jobs/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: 'whatever' }),
    });
    expect(res.status).toBe(401);
  });

  it('is not auth-gated by the normal API auth (signature path, not 401-UNAUTHORIZED-from-requireAuth shape aside)', async () => {
    // Even with a bearer token it still requires the QStash signature.
    const res = await app.request('/v1/internal/generation-jobs/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-jwt' },
      body: JSON.stringify({ job_id: 'whatever' }),
    });
    expect(res.status).toBe(401);
  });
});
