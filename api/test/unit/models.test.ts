import { describe, it, expect } from 'vitest';
import {
  ALLOWED_MODELS,
  DEFAULT_MODEL,
  planAllowsModel,
} from '../../src/lib/openai/models.js';

describe('models', () => {
  it('includes the default model in the allowlist', () => {
    expect(ALLOWED_MODELS).toContain(DEFAULT_MODEL);
  });

  it('lets any plan use a free-tier model', () => {
    expect(planAllowsModel('free', DEFAULT_MODEL)).toBe(true);
  });

  it('blocks free plans from paid models', () => {
    expect(planAllowsModel('free', 'gpt-4o')).toBe(false);
  });

  it('allows paid plans to use paid models', () => {
    expect(planAllowsModel('student', 'gpt-4o')).toBe(true);
  });

  it('rejects unknown models for everyone', () => {
    expect(planAllowsModel('enterprise', 'nope')).toBe(false);
  });
});
