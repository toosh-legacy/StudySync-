import { describe, it, expect } from 'vitest';
import { estimateCostUsd, planBudget, PLAN_TOKEN_BUDGET } from '../../src/lib/billing.js';

describe('estimateCostUsd', () => {
  it('uses the default model pricing (gpt-4o-mini)', () => {
    // 1M prompt @0.15 + 1M completion @0.60 = 0.75
    expect(estimateCostUsd(1_000_000, 1_000_000)).toBeCloseTo(0.75, 6);
  });

  it('uses per-model pricing when specified', () => {
    // gpt-4o: 1M @2.5 + 1M @10 = 12.5
    expect(estimateCostUsd(1_000_000, 1_000_000, 'gpt-4o')).toBeCloseTo(12.5, 6);
  });

  it('falls back to default pricing for unknown models', () => {
    expect(estimateCostUsd(1_000_000, 1_000_000, 'made-up')).toBeCloseTo(0.75, 6);
  });

  it('is zero for zero tokens', () => {
    expect(estimateCostUsd(0, 0)).toBe(0);
  });
});

describe('planBudget', () => {
  it('returns the configured budget for a known plan', () => {
    expect(planBudget('student')).toBe(PLAN_TOKEN_BUDGET.student);
  });
  it('falls back to the free budget for unknown plans', () => {
    expect(planBudget('mystery')).toBe(PLAN_TOKEN_BUDGET.free);
  });
});
