// Allowlist of OpenAI models callers may request, with per-model pricing and the
// minimum plan required. Adding a model here is the only change needed to expose it.
//
// NOTE on the project's "gpt-4o-mini only" guidance: gpt-4o-mini remains the DEFAULT
// for every request and the only model free-plan users can run. Larger models are
// exposed deliberately as an opt-in, plan-gated capability of the public generation
// API (paid plans only) so external developers can trade cost for quality — this is
// the explicit, intentional reason for offering models beyond gpt-4o-mini.

export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

export interface ModelInfo {
  /** Plans below this tier cannot use the model. 'free' = available to everyone. */
  minPlan: 'free' | 'paid';
  pricing: ModelPricing;
}

export const DEFAULT_MODEL = 'gpt-4o-mini';

// USD per 1M tokens.
export const MODELS: Record<string, ModelInfo> = {
  'gpt-4o-mini': {
    minPlan: 'free',
    pricing: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  },
  'gpt-4.1-mini': {
    minPlan: 'free',
    pricing: { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  },
  'gpt-4o': {
    minPlan: 'paid',
    pricing: { inputPerMillion: 2.5, outputPerMillion: 10 },
  },
};

export const ALLOWED_MODELS = Object.keys(MODELS);

export const modelPricing: Record<string, ModelPricing> = Object.fromEntries(
  Object.entries(MODELS).map(([name, info]) => [name, info.pricing]),
);

const FREE_PLANS = new Set(['free']);

/** Returns true if the given plan is allowed to use the given model. */
export function planAllowsModel(plan: string, model: string): boolean {
  const info = MODELS[model];
  if (!info) return false;
  if (info.minPlan === 'free') return true;
  return !FREE_PLANS.has(plan);
}
