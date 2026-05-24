import { describe, it, expect } from 'vitest';
import {
  generateRequestSchema,
  courseCreateSchema,
  courseUpdateSchema,
  preferencesUpdateSchema,
  apiKeyCreateSchema,
  collectRequestSchema,
} from '../../src/types/api.js';

const COURSE_ID = '22222222-2222-2222-2222-222222222222';

describe('generateRequestSchema', () => {
  const valid = {
    course_id: COURSE_ID,
    output_format: 'flashcards',
    sources: [{ provider: 'notion', source_name: 'A', content: 'hello' }],
  };

  it('accepts a minimal valid request and applies defaults', () => {
    const r = generateRequestSchema.parse(valid);
    expect(r.depth).toBe('standard');
    expect(r.comprehension).toBe('intermediate');
    expect(r.model).toBeUndefined();
  });

  it('accepts a valid model from the allowlist', () => {
    const r = generateRequestSchema.parse({ ...valid, model: 'gpt-4o' });
    expect(r.model).toBe('gpt-4o');
  });

  it('rejects a model outside the allowlist', () => {
    expect(generateRequestSchema.safeParse({ ...valid, model: 'gpt-9' }).success).toBe(false);
  });

  it('rejects an invalid comprehension level', () => {
    expect(
      generateRequestSchema.safeParse({ ...valid, comprehension: 'genius' }).success,
    ).toBe(false);
  });

  it('rejects empty sources and over-long content', () => {
    expect(generateRequestSchema.safeParse({ ...valid, sources: [] }).success).toBe(false);
    expect(
      generateRequestSchema.safeParse({
        ...valid,
        sources: [{ provider: 'x', source_name: 'y', content: 'a'.repeat(50_001) }],
      }).success,
    ).toBe(false);
  });

  it('rejects a non-uuid course_id', () => {
    expect(generateRequestSchema.safeParse({ ...valid, course_id: 'nope' }).success).toBe(false);
  });
});

describe('courseCreateSchema', () => {
  it('uppercases the code and accepts a hex color', () => {
    const r = courseCreateSchema.parse({ name: 'Bio', code: 'bio101', color: '#1D9E75' });
    expect(r.code).toBe('BIO101');
  });
  it('rejects a bad color', () => {
    expect(courseCreateSchema.safeParse({ name: 'Bio', color: 'red' }).success).toBe(false);
  });
  it('rejects an empty name', () => {
    expect(courseCreateSchema.safeParse({ name: '' }).success).toBe(false);
  });
});

describe('courseUpdateSchema', () => {
  it('rejects an empty object', () => {
    expect(courseUpdateSchema.safeParse({}).success).toBe(false);
  });
  it('accepts a single field', () => {
    expect(courseUpdateSchema.safeParse({ archived: true }).success).toBe(true);
  });
});

describe('preferencesUpdateSchema', () => {
  it('rejects an empty object', () => {
    expect(preferencesUpdateSchema.safeParse({}).success).toBe(false);
  });
  it('accepts valid fields', () => {
    expect(
      preferencesUpdateSchema.safeParse({ default_format: 'notes', auto_scan_page: true }).success,
    ).toBe(true);
  });
});

describe('apiKeyCreateSchema', () => {
  it('requires a label', () => {
    expect(apiKeyCreateSchema.safeParse({}).success).toBe(false);
    expect(apiKeyCreateSchema.safeParse({ label: 'CI key' }).success).toBe(true);
  });
});

describe('collectRequestSchema', () => {
  it('accepts providers and optional page content', () => {
    const r = collectRequestSchema.parse({
      course_id: COURSE_ID,
      providers: ['notion', 'canvas'],
      current_page_content: 'text',
    });
    expect(r.providers).toEqual(['notion', 'canvas']);
  });
  it('rejects an unknown provider', () => {
    expect(
      collectRequestSchema.safeParse({ course_id: COURSE_ID, providers: ['dropbox'] }).success,
    ).toBe(false);
  });
});
