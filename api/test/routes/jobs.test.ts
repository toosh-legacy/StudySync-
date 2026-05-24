import { describe, it, expect, beforeEach } from 'vitest';
import { app, db, resetMocks, auth, jsonReq, TEST_USER_ID } from '../helpers/testApp.js';

beforeEach(resetMocks);

const CID = '33333333-3333-3333-3333-333333333333';

function seedCourse() {
  db().seed('courses', [{ id: CID, user_id: TEST_USER_ID, name: 'Bio 101' }]);
}
function reqBody(overrides: Record<string, unknown> = {}) {
  return {
    course_id: CID,
    output_format: 'summary',
    sources: [{ provider: 'notion', source_name: 'Doc A', content: 'cell biology content' }],
    ...overrides,
  };
}

async function waitForJob(jobId: string) {
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 0));
    const res = await app.request(`/v1/generate/jobs/${jobId}`, { headers: auth() });
    const body = await (res.json() as Promise<any>);
    if (body.status === 'completed' || body.status === 'failed') return body;
  }
  throw new Error('job did not finish in time');
}

describe('async generation jobs', () => {
  it('accepts a job and runs it to completion', async () => {
    seedCourse();
    const res = await app.request('/v1/generate/jobs', jsonReq('POST', reqBody()));
    expect(res.status).toBe(202);
    const { job_id, status } = await (res.json() as Promise<any>);
    expect(status).toBe('queued');

    const job = await waitForJob(job_id);
    expect(job.status).toBe('completed');
    expect(job.result.output).toBeTruthy();
    expect(db().get('generated_outputs').length).toBe(1);
  });

  it('records a failed job when the course is missing', async () => {
    // no course seeded
    const res = await app.request('/v1/generate/jobs', jsonReq('POST', reqBody()));
    expect(res.status).toBe(202);
    const { job_id } = await (res.json() as Promise<any>);
    const job = await waitForJob(job_id);
    expect(job.status).toBe('failed');
    expect(job.error.error).toBe('NOT_FOUND');
  });

  it('rejects a premium model on the free plan at submission', async () => {
    seedCourse();
    const res = await app.request('/v1/generate/jobs', jsonReq('POST', reqBody({ model: 'gpt-4o' })));
    expect(res.status).toBe(403);
  });

  it('404s for an unknown job id', async () => {
    const res = await app.request('/v1/generate/jobs/99999999-9999-9999-9999-999999999999', {
      headers: auth(),
    });
    expect(res.status).toBe(404);
  });
});
