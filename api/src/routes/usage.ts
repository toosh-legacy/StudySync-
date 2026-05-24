import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { createAdminClient } from '../lib/supabase.js';
import { apiError, ErrorCode } from '../lib/errors.js';
import { getUser, sendError } from '../lib/http.js';
import { estimateCostUsd } from '../lib/billing.js';

export const usageRouter = new Hono();
usageRouter.use('*', requireAuth);

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

interface DayBucket {
  date: string;
  generations: number;
  cache_hits: number;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost_usd: number;
}

usageRouter.get('/', async (c) => {
  const user = getUser(c);
  const parsed = querySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return sendError(c, apiError(ErrorCode.VALIDATION_ERROR, parsed.error.issues[0].message, 422));
  }
  const { days } = parsed.data;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('generated_outputs')
    .select('prompt_tokens, completion_tokens, model_used, cache_hit, created_at')
    .eq('user_id', user.userId)
    .gte('created_at', since);
  if (error) {
    return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'Failed to load usage', 500));
  }

  const byDay = new Map<string, DayBucket>();
  for (const row of data ?? []) {
    const date = String(row.created_at).slice(0, 10);
    const b =
      byDay.get(date) ??
      { date, generations: 0, cache_hits: 0, prompt_tokens: 0, completion_tokens: 0, estimated_cost_usd: 0 };
    b.generations += 1;
    if (row.cache_hit) b.cache_hits += 1;
    const p = row.prompt_tokens ?? 0;
    const comp = row.completion_tokens ?? 0;
    b.prompt_tokens += p;
    b.completion_tokens += comp;
    if (!row.cache_hit) b.estimated_cost_usd += estimateCostUsd(p, comp, row.model_used ?? undefined);
    byDay.set(date, b);
  }

  const daily = [...byDay.values()]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((b) => ({
      ...b,
      total_tokens: b.prompt_tokens + b.completion_tokens,
      estimated_cost_usd: Number(b.estimated_cost_usd.toFixed(6)),
    }));

  const totals = daily.reduce(
    (t, b) => ({
      generations: t.generations + b.generations,
      cache_hits: t.cache_hits + b.cache_hits,
      prompt_tokens: t.prompt_tokens + b.prompt_tokens,
      completion_tokens: t.completion_tokens + b.completion_tokens,
      estimated_cost_usd: t.estimated_cost_usd + b.estimated_cost_usd,
    }),
    { generations: 0, cache_hits: 0, prompt_tokens: 0, completion_tokens: 0, estimated_cost_usd: 0 },
  );

  return c.json({
    range_days: days,
    daily,
    totals: {
      ...totals,
      total_tokens: totals.prompt_tokens + totals.completion_tokens,
      estimated_cost_usd: Number(totals.estimated_cost_usd.toFixed(6)),
    },
  });
});
