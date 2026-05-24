import { describe, it, expect, beforeEach } from 'vitest';
import { app, db, resetMocks, auth, jsonReq, TEST_USER_ID } from '../helpers/testApp.js';

beforeEach(resetMocks);

const CID = '33333333-3333-3333-3333-333333333333';

function seedCourse(overrides: Record<string, unknown> = {}) {
  db().seed('courses', [
    {
      id: CID,
      user_id: TEST_USER_ID,
      name: 'Bio',
      code: 'BIO',
      color: '#1D9E75',
      archived: false,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      ...overrides,
    },
  ]);
}

describe('courses', () => {
  it('lists non-archived courses', async () => {
    seedCourse();
    const res = await app.request('/v1/courses', { headers: auth() });
    expect(res.status).toBe(200);
    expect((await (res.json() as Promise<any>))).toHaveLength(1);
  });

  it('creates a course with a default color', async () => {
    const res = await app.request('/v1/courses', jsonReq('POST', { name: 'Chem' }));
    expect(res.status).toBe(201);
    const body = await (res.json() as Promise<any>);
    expect(body.color).toBe('#1D9E75');
    expect(body.name).toBe('Chem');
  });

  it('rejects an invalid create body', async () => {
    const res = await app.request('/v1/courses', jsonReq('POST', { name: '' }));
    expect(res.status).toBe(422);
  });

  it('gets a course by id', async () => {
    seedCourse();
    const res = await app.request(`/v1/courses/${CID}`, { headers: auth() });
    expect(res.status).toBe(200);
    expect((await (res.json() as Promise<any>)).id).toBe(CID);
  });

  it('returns 404 for an invalid uuid', async () => {
    const res = await app.request('/v1/courses/not-a-uuid', { headers: auth() });
    expect(res.status).toBe(404);
  });

  it('does not leak another user\'s course', async () => {
    seedCourse({ user_id: 'someone-else' });
    const res = await app.request(`/v1/courses/${CID}`, { headers: auth() });
    expect(res.status).toBe(404);
  });

  it('updates a course', async () => {
    seedCourse();
    const res = await app.request(`/v1/courses/${CID}`, jsonReq('PATCH', { name: 'Biology' }));
    expect(res.status).toBe(200);
    expect((await (res.json() as Promise<any>)).name).toBe('Biology');
  });

  it('rejects an empty update', async () => {
    seedCourse();
    const res = await app.request(`/v1/courses/${CID}`, jsonReq('PATCH', {}));
    expect(res.status).toBe(422);
  });

  it('404s when updating a missing course', async () => {
    const res = await app.request(`/v1/courses/${CID}`, jsonReq('PATCH', { name: 'X' }));
    expect(res.status).toBe(404);
  });

  it('deletes a course', async () => {
    seedCourse();
    const res = await app.request(`/v1/courses/${CID}`, { method: 'DELETE', headers: auth() });
    expect(res.status).toBe(204);
    expect(db().get('courses')).toHaveLength(0);
  });

  it('404s when deleting a missing course', async () => {
    const res = await app.request(`/v1/courses/${CID}`, { method: 'DELETE', headers: auth() });
    expect(res.status).toBe(404);
  });
});
