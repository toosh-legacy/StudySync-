// Plan token budgets and OpenAI cost estimation. Kept dependency-free so it can
// be unit-tested without an HTTP context.

import { modelPricing, DEFAULT_MODEL } from './openai/models.js';

export const PLAN_TOKEN_BUDGET: Record<string, number> = {
  free: 100_000,
  student: 500_000,
  team: 2_000_000,
  enterprise: Number.MAX_SAFE_INTEGER,
  developer: 200_000,
};

export function planBudget(plan: string): number {
  return PLAN_TOKEN_BUDGET[plan] ?? PLAN_TOKEN_BUDGET.free;
}

/**
 * Estimate USD cost for a completion. Prices are per 1M tokens and vary by model;
 * unknown models fall back to the default model's pricing.
 */
export function estimateCostUsd(
  promptTokens: number,
  completionTokens: number,
  model: string = DEFAULT_MODEL,
): number {
  const price = modelPricing[model] ?? modelPricing[DEFAULT_MODEL];
  return (
    (promptTokens / 1_000_000) * price.inputPerMillion +
    (completionTokens / 1_000_000) * price.outputPerMillion
  );
}
