import { describe, it, expect } from 'vitest';
import {
  SYSTEM_PROMPTS,
  DEPTH_INSTRUCTIONS,
  COMPREHENSION_INSTRUCTIONS,
  FORMAT_OUTPUT_SHAPES,
} from '../../src/lib/openai/prompts.js';
import { buildUserMessage } from '../../src/lib/openai/generate.js';

const FORMATS = [
  'flashcards',
  'study_guide',
  'notes',
  'practice_questions',
  'summary',
  'mind_map',
] as const;

describe('prompt tables', () => {
  it('has a system prompt for every format', () => {
    for (const f of FORMATS) {
      expect(SYSTEM_PROMPTS[f]).toBeTruthy();
      expect(SYSTEM_PROMPTS[f]).toContain('sources_used');
    }
  });

  it('has an output shape for every format', () => {
    for (const f of FORMATS) expect(FORMAT_OUTPUT_SHAPES[f]).toBeTruthy();
  });

  it('has 3 depth and 4 comprehension instructions', () => {
    expect(Object.keys(DEPTH_INSTRUCTIONS)).toHaveLength(3);
    expect(Object.keys(COMPREHENSION_INSTRUCTIONS)).toHaveLength(4);
  });
});

describe('buildUserMessage', () => {
  it('includes course, format, depth, audience, sources, prompt, and retry hint', () => {
    const msg = buildUserMessage({
      format: 'summary',
      depth: 'deep',
      comprehension: 'expert',
      sources: [{ provider: 'notion', source_name: 'Doc A', content: 'CONTENT_A' }],
      courseName: 'Biology 101',
      userPrompt: 'focus on mitosis',
      retryHint: 'return valid JSON',
    });
    expect(msg).toContain('Course: Biology 101');
    expect(msg).toContain('Output format: summary');
    expect(msg).toContain(DEPTH_INSTRUCTIONS.deep);
    expect(msg).toContain(COMPREHENSION_INSTRUCTIONS.expert);
    expect(msg).toContain('focus on mitosis');
    expect(msg).toContain('return valid JSON');
    expect(msg).toContain('CONTENT_A');
    expect(msg).toContain('(notion: Doc A)');
  });

  it('omits optional lines when absent', () => {
    const msg = buildUserMessage({
      format: 'flashcards',
      depth: 'quick',
      comprehension: 'beginner',
      sources: [{ provider: 'x', source_name: 'y', content: 'z' }],
      courseName: 'C',
    });
    expect(msg).not.toContain('User request:');
    expect(msg).not.toContain('IMPORTANT:');
  });
});
