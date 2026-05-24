import { describe, it, expect } from 'vitest';
import { buildCacheKey } from '../../src/lib/cache.js';

const base = {
  courseId: 'c1',
  format: 'flashcards',
  depth: 'standard',
  comprehension: 'intermediate',
  model: 'gpt-4o-mini',
  sourceContents: ['alpha', 'beta'],
};

describe('buildCacheKey', () => {
  it('is deterministic for identical input', () => {
    expect(buildCacheKey(base)).toBe(buildCacheKey({ ...base }));
  });

  it('is independent of source order', () => {
    const reversed = { ...base, sourceContents: ['beta', 'alpha'] };
    expect(buildCacheKey(base)).toBe(buildCacheKey(reversed));
  });

  it('changes when format changes', () => {
    expect(buildCacheKey(base)).not.toBe(buildCacheKey({ ...base, format: 'summary' }));
  });

  it('changes when depth changes', () => {
    expect(buildCacheKey(base)).not.toBe(buildCacheKey({ ...base, depth: 'deep' }));
  });

  it('changes when comprehension changes', () => {
    expect(buildCacheKey(base)).not.toBe(
      buildCacheKey({ ...base, comprehension: 'expert' }),
    );
  });

  it('changes when model changes', () => {
    expect(buildCacheKey(base)).not.toBe(buildCacheKey({ ...base, model: 'gpt-4o' }));
  });

  it('changes when source content changes', () => {
    expect(buildCacheKey(base)).not.toBe(
      buildCacheKey({ ...base, sourceContents: ['alpha', 'gamma'] }),
    );
  });

  it('returns a 64-char hex digest', () => {
    expect(buildCacheKey(base)).toMatch(/^[0-9a-f]{64}$/);
  });
});
