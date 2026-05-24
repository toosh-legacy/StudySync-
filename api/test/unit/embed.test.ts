import { describe, it, expect } from 'vitest';
import { chunkText, cosine } from '../../src/lib/openai/embed.js';

describe('chunkText', () => {
  it('returns a single chunk for short text', () => {
    expect(chunkText('hello world', 100)).toEqual(['hello world']);
  });

  it('returns no chunks for empty/whitespace', () => {
    expect(chunkText('   ')).toEqual([]);
  });

  it('splits long text into overlapping chunks that cover the content', () => {
    const text = Array.from({ length: 500 }, (_, i) => `word${i}`).join(' ');
    const chunks = chunkText(text, 200, 40);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].length).toBeLessThanOrEqual(200);
    // First and last words are present somewhere.
    expect(chunks.join(' ')).toContain('word0');
    expect(chunks.join(' ')).toContain('word499');
  });
});

describe('cosine', () => {
  it('is 1 for identical vectors', () => {
    expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
  });
  it('is 0 for orthogonal vectors', () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });
  it('is 0 when a vector is all zeros', () => {
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });
  it('ranks a closer vector higher', () => {
    const q = [1, 1, 0];
    const near = cosine(q, [1, 1, 0.1]);
    const far = cosine(q, [0, 0, 1]);
    expect(near).toBeGreaterThan(far);
  });
});
