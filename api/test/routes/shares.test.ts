import { describe, it, expect, beforeEach } from 'vitest';
import { app, db, resetMocks, TEST_USER_ID } from '../helpers/testApp.js';

beforeEach(resetMocks);

const OID = '66666666-6666-6666-6666-666666666666';
const CID = '33333333-3333-3333-3333-333333333333';

describe('GET /v1/shares/:id (public)', () => {
  it('returns a publicly shared output with course info, no auth', async () => {
    db().seed('generated_outputs', [
      {
        id: OID,
        user_id: TEST_USER_ID,
        course_id: CID,
        output_format: 'summary',
        depth: 'standard',
        output: { headline: 'Hi' },
        sources_used_count: 1,
        public_share: true,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    db().seed('courses', [{ id: CID, name: 'Bio', code: 'BIO' }]);

    const res = await app.request(`/v1/shares/${OID}`);
    expect(res.status).toBe(200);
    const body = await (res.json() as Promise<any>);
    expect(body.course.name).toBe('Bio');
    expect(body.output_format).toBe('summary');
  });

  it('404s for an output that is not public', async () => {
    db().seed('generated_outputs', [
      { id: OID, user_id: TEST_USER_ID, course_id: CID, output: {}, public_share: false },
    ]);
    const res = await app.request(`/v1/shares/${OID}`);
    expect(res.status).toBe(404);
  });

  it('404s for an invalid uuid', async () => {
    const res = await app.request('/v1/shares/not-a-uuid');
    expect(res.status).toBe(404);
  });
});
