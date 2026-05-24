import { describe, it, expect, beforeEach } from 'vitest';
import {
  app,
  db,
  resetMocks,
  auth,
  jsonReq,
  setRateLimit,
  setGenerate,
  setGenerateStream,
  setPlan,
  TEST_USER_ID,
} from '../helpers/testApp.js';
import { buildCacheKey } from '../../src/lib/cache.js';

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

describe('POST /v1/generate', () => {
  it('generates a fresh output and persists it', async () => {
    seedCourse();
    const res = await app.request('/v1/generate', jsonReq('POST', reqBody()));
    expect(res.status).toBe(200);
    const body = await (res.json() as Promise<any>);
    expect(body.cache_hit).toBe(false);
    expect(body.comprehension).toBe('intermediate');
    expect(body.output.result).toBe('ok');
    expect(body.sources_read[0].source_name).toBe('Doc A');
    expect(body.usage.model).toBe('gpt-4o-mini');
    expect(db().get('generated_outputs')).toHaveLength(1);
    expect(db().rpcCalls.some((c) => c.name === 'increment_token_usage')).toBe(true);
  });

  it('returns a cache hit without calling the model', async () => {
    seedCourse();
    setGenerate(async () => {
      throw new Error('model should not be called on cache hit');
    });
    const content = 'cell biology content';
    const cacheKey = buildCacheKey({
      courseId: CID,
      format: 'summary',
      depth: 'standard',
      comprehension: 'intermediate',
      model: 'gpt-4o-mini',
      sourceContents: [content],
    });
    db().seed('generated_outputs', [
      {
        id: 'cached-1',
        user_id: TEST_USER_ID,
        course_id: CID,
        cache_key: cacheKey,
        output_format: 'summary',
        depth: 'standard',
        output: { headline: 'cached' },
        sources_read: [],
        sources_used_count: 1,
        prompt_tokens: 10,
        completion_tokens: 5,
        model_used: 'gpt-4o-mini',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const res = await app.request('/v1/generate', jsonReq('POST', reqBody()));
    expect(res.status).toBe(200);
    const body = await (res.json() as Promise<any>);
    expect(body.cache_hit).toBe(true);
    expect(body.request_id).toBe('cached-1');
  });

  it('429s when rate limited', async () => {
    setRateLimit(false);
    const res = await app.request('/v1/generate', jsonReq('POST', reqBody()));
    expect(res.status).toBe(429);
    expect((await (res.json() as Promise<any>)).error).toBe('RATE_LIMITED');
  });

  it('422s when total content exceeds the limit', async () => {
    seedCourse();
    const sources = Array.from({ length: 8 }, (_, i) => ({
      provider: 'x',
      source_name: `s${i}`,
      content: 'a'.repeat(40_000),
    }));
    const res = await app.request('/v1/generate', jsonReq('POST', reqBody({ sources })));
    expect(res.status).toBe(422);
  });

  it('404s when the course is missing', async () => {
    const res = await app.request('/v1/generate', jsonReq('POST', reqBody()));
    expect(res.status).toBe(404);
  });

  it('429s when the daily budget is exhausted', async () => {
    seedCourse();
    db().seed('token_usage', [
      { user_id: TEST_USER_ID, date: new Date().toISOString().slice(0, 10), tokens_used: 1_000_000 },
    ]);
    const res = await app.request('/v1/generate', jsonReq('POST', reqBody()));
    expect(res.status).toBe(429);
    expect((await (res.json() as Promise<any>)).error).toBe('BUDGET_EXHAUSTED');
  });

  it('403s when the plan may not use the requested model', async () => {
    seedCourse();
    const res = await app.request('/v1/generate', jsonReq('POST', reqBody({ model: 'gpt-4o' })));
    expect(res.status).toBe(403);
  });

  it('allows a paid plan to use a premium model', async () => {
    seedCourse();
    setPlan('student');
    const res = await app.request('/v1/generate', jsonReq('POST', reqBody({ model: 'gpt-4o' })));
    expect(res.status).toBe(200);
    expect((await (res.json() as Promise<any>)).usage.model).toBe('gpt-4o');
  });

  it('threads the comprehension level into generation', async () => {
    seedCourse();
    let seen: any;
    setGenerate(async (opts) => {
      seen = opts;
      return {
        raw: JSON.stringify({ ok: true, sources_used: [] }),
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        model: 'gpt-4o-mini',
      };
    });
    const res = await app.request('/v1/generate', jsonReq('POST', reqBody({ comprehension: 'expert' })));
    expect(res.status).toBe(200);
    expect(seen.comprehension).toBe('expert');
    expect((await (res.json() as Promise<any>)).comprehension).toBe('expert');
  });

  it('maps AI provider unavailability to 503', async () => {
    seedCourse();
    setGenerate(async () => {
      throw { status: 503 };
    });
    const res = await app.request('/v1/generate', jsonReq('POST', reqBody()));
    expect(res.status).toBe(503);
    expect((await (res.json() as Promise<any>)).error).toBe('AI_UNAVAILABLE');
  });

  it('retries once on invalid JSON, then succeeds', async () => {
    seedCourse();
    let n = 0;
    setGenerate(async () => {
      n += 1;
      return {
        raw: n === 1 ? 'not json' : JSON.stringify({ ok: true, sources_used: [] }),
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        model: 'gpt-4o-mini',
      };
    });
    const res = await app.request('/v1/generate', jsonReq('POST', reqBody()));
    expect(res.status).toBe(200);
    expect(n).toBe(2);
  });

  it('replays the stored response for a repeated Idempotency-Key', async () => {
    seedCourse();
    let calls = 0;
    setGenerate(async (opts) => {
      calls += 1;
      return {
        raw: JSON.stringify({ ok: true, sources_used: [] }),
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        model: 'gpt-4o-mini',
      };
    });
    const init = jsonReq('POST', reqBody());
    (init.headers as Record<string, string>)['Idempotency-Key'] = 'idem-1';

    const first = await app.request('/v1/generate', init);
    const firstBody = await (first.json() as Promise<any>);
    const second = await app.request('/v1/generate', { ...init });
    const secondBody = await (second.json() as Promise<any>);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(secondBody.request_id).toBe(firstBody.request_id);
    expect(calls).toBe(1); // model called only once
  });

  it('409s when an Idempotency-Key is reused with a different body', async () => {
    seedCourse();
    const init1 = jsonReq('POST', reqBody());
    (init1.headers as Record<string, string>)['Idempotency-Key'] = 'idem-2';
    await app.request('/v1/generate', init1);

    const init2 = jsonReq('POST', reqBody({ output_format: 'flashcards' }));
    (init2.headers as Record<string, string>)['Idempotency-Key'] = 'idem-2';
    const res = await app.request('/v1/generate', init2);
    expect(res.status).toBe(409);
  });

  it('500s when the model never returns valid JSON', async () => {
    seedCourse();
    setGenerate(async () => ({
      raw: 'still not json',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      model: 'gpt-4o-mini',
    }));
    const res = await app.request('/v1/generate', jsonReq('POST', reqBody()));
    expect(res.status).toBe(500);
  });
});

describe('POST /v1/generate/stream', () => {
  it('streams meta, delta, and done events and persists the output', async () => {
    seedCourse();
    const res = await app.request('/v1/generate/stream', jsonReq('POST', reqBody()));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const text = await res.text();
    expect(text).toContain('event: meta');
    expect(text).toContain('event: delta');
    expect(text).toContain('event: done');
    expect(db().get('generated_outputs')).toHaveLength(1);
  });

  it('emits a single done event on a cache hit', async () => {
    seedCourse();
    setGenerateStream(async function* () {
      throw new Error('stream should not run on cache hit');
    });
    const content = 'cell biology content';
    const cacheKey = buildCacheKey({
      courseId: CID,
      format: 'summary',
      depth: 'standard',
      comprehension: 'intermediate',
      model: 'gpt-4o-mini',
      sourceContents: [content],
    });
    db().seed('generated_outputs', [
      {
        id: 'cached-2',
        user_id: TEST_USER_ID,
        course_id: CID,
        cache_key: cacheKey,
        output_format: 'summary',
        depth: 'standard',
        output: { headline: 'cached' },
        sources_read: [],
        sources_used_count: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        model_used: 'gpt-4o-mini',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const res = await app.request('/v1/generate/stream', jsonReq('POST', reqBody()));
    const text = await res.text();
    expect(text).toContain('"cache_hit":true');
    expect(text).toContain('event: done');
    expect(text).not.toContain('event: delta');
  });
});
