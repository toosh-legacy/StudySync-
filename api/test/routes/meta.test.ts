import { describe, it, expect } from 'vitest';
import { app } from '../helpers/testApp.js';

describe('GET /v1/meta/formats', () => {
  it('describes formats, depths, comprehension levels, models, and limits (no auth)', async () => {
    const res = await app.request('/v1/meta/formats');
    expect(res.status).toBe(200);
    const body = await (res.json() as Promise<any>);
    expect(body.output_formats).toHaveLength(6);
    expect(body.depths).toHaveLength(3);
    expect(body.comprehension_levels).toHaveLength(4);
    const def = body.models.find((m: any) => m.default);
    expect(def.id).toBe('gpt-4o-mini');
    expect(body.limits.max_total_chars).toBe(300_000);
  });
});

describe('GET /v1/openapi.json', () => {
  it('serves a valid OpenAPI 3.1 document at the root', async () => {
    const res = await app.request('/v1/openapi.json');
    expect(res.status).toBe(200);
    const spec = await (res.json() as Promise<any>);
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.paths['/v1/generate']).toBeTruthy();
    expect(spec.paths['/v1/generate/stream']).toBeTruthy();
    expect(spec.components.schemas.GenerateRequest).toBeTruthy();
  });

  it('also serves the spec under /v1/meta', async () => {
    const res = await app.request('/v1/meta/openapi.json');
    expect(res.status).toBe(200);
  });
});
