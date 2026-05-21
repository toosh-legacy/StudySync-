import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { createAdminClient } from '../lib/supabase.js';
import { apiError, ErrorCode } from '../lib/errors.js';
import { getUser, parseJson, sendError } from '../lib/http.js';
import { buildCacheKey } from '../lib/cache.js';
import { generateLimiter } from '../lib/ratelimit.js';
import { callGenerate } from '../lib/openai/generate.js';
import { generateRequestSchema } from '../types/api.js';
import type { Json } from '../types/database.js';

export const generateRouter = new Hono();
generateRouter.use('*', requireAuth);

const PLAN_TOKEN_BUDGET: Record<string, number> = {
  free: 100_000,
  student: 500_000,
  team: 2_000_000,
  enterprise: Number.MAX_SAFE_INTEGER,
  developer: 200_000,
};

const TOTAL_CHAR_LIMIT = 300_000;

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function estimateCostUsd(promptTokens: number, completionTokens: number): number {
  return (promptTokens / 1_000_000) * 0.15 + (completionTokens / 1_000_000) * 0.6;
}

generateRouter.post('/', async (c) => {
  const user = getUser(c);

  const limit = await generateLimiter.limit(`gen:${user.userId}`);
  if (!limit.success) {
    return sendError(
      c,
      apiError(ErrorCode.RATE_LIMITED, 'Too many generation requests. Please slow down.', 429),
    );
  }

  const parsed = await parseJson(c, generateRequestSchema);
  if ('error' in parsed) return sendError(c, parsed.error);
  const body = parsed.data;

  const totalChars = body.sources.reduce((sum, s) => sum + s.content.length, 0);
  if (totalChars > TOTAL_CHAR_LIMIT) {
    return sendError(
      c,
      apiError(
        ErrorCode.VALIDATION_ERROR,
        `Total source content exceeds ${TOTAL_CHAR_LIMIT.toLocaleString()} characters`,
        422,
      ),
    );
  }

  const admin = createAdminClient();
  const { data: course } = await admin
    .from('courses')
    .select('id, name')
    .eq('id', body.course_id)
    .eq('user_id', user.userId)
    .maybeSingle();
  if (!course) {
    return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Course not found', 404));
  }

  const cacheKey = buildCacheKey(
    body.course_id,
    body.output_format,
    body.depth,
    body.sources.map((s) => s.content),
  );

  const { data: cached } = await admin
    .from('generated_outputs')
    .select('*')
    .eq('cache_key', cacheKey)
    .eq('user_id', user.userId)
    .maybeSingle();
  if (cached) {
    return c.json({
      request_id: cached.id,
      cache_hit: true,
      course_id: cached.course_id,
      output_format: cached.output_format,
      depth: cached.depth,
      output: cached.output,
      sources_read: cached.sources_read,
      sources_used_count: cached.sources_used_count,
      usage: {
        prompt_tokens: cached.prompt_tokens ?? 0,
        completion_tokens: cached.completion_tokens ?? 0,
        total_tokens: (cached.prompt_tokens ?? 0) + (cached.completion_tokens ?? 0),
        estimated_cost_usd: 0,
        model: cached.model_used ?? 'gpt-4o-mini',
      },
      generated_at: cached.created_at,
    });
  }

  const { data: usageRow } = await admin
    .from('token_usage')
    .select('tokens_used')
    .eq('user_id', user.userId)
    .eq('date', todayDateString())
    .maybeSingle();
  const tokensUsedToday = usageRow?.tokens_used ?? 0;
  const budget = PLAN_TOKEN_BUDGET[user.plan] ?? PLAN_TOKEN_BUDGET.free;
  if (tokensUsedToday >= budget) {
    return sendError(
      c,
      apiError(
        ErrorCode.BUDGET_EXHAUSTED,
        `Daily token budget exceeded (${tokensUsedToday}/${budget}).`,
        429,
      ),
    );
  }

  let result;
  try {
    result = await callGenerate(
      body.output_format,
      body.depth,
      body.sources.map((s) => ({
        provider: s.provider,
        source_name: s.source_name,
        content: s.content,
      })),
      course.name,
      body.user_prompt,
    );
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 429 || status === 503) {
      return sendError(
        c,
        apiError(ErrorCode.AI_UNAVAILABLE, 'AI provider unavailable; please retry shortly.', 503),
      );
    }
    const msg = err instanceof Error ? err.message : 'unknown';
    if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
      return sendError(c, apiError(ErrorCode.AI_UNAVAILABLE, 'AI provider unreachable.', 503));
    }
    return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'Generation failed', 500));
  }

  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(result.raw);
  } catch {
    try {
      result = await callGenerate(
        body.output_format,
        body.depth,
        body.sources.map((s) => ({
          provider: s.provider,
          source_name: s.source_name,
          content: s.content,
        })),
        course.name,
        body.user_prompt,
        'Your previous response was not valid JSON. Return only a valid JSON object matching the schema.',
      );
      parsedOutput = JSON.parse(result.raw);
    } catch {
      return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'Could not parse AI response', 500));
    }
  }

  const obj =
    parsedOutput && typeof parsedOutput === 'object'
      ? (parsedOutput as Record<string, unknown>)
      : {};
  const sourcesUsedRaw = Array.isArray(obj.sources_used)
    ? (obj.sources_used as Array<{ source_name?: string; relevance_note?: string }>)
    : [];
  delete obj.sources_used;

  const sourcesRead = body.sources.map((s) => {
    const match = sourcesUsedRaw.find((u) => u.source_name === s.source_name);
    return {
      provider: s.provider,
      source_name: s.source_name,
      source_url: s.source_url ?? null,
      characters_read: s.content.length,
      status: 'success' as const,
      relevance_note: match?.relevance_note ?? 'Read but not directly cited.',
    };
  });

  const requestId = randomUUID();
  const { data: inserted, error: insertErr } = await admin
    .from('generated_outputs')
    .insert({
      id: requestId,
      user_id: user.userId,
      course_id: body.course_id,
      cache_key: cacheKey,
      output_format: body.output_format,
      depth: body.depth,
      output: obj as Json,
      sources_read: sourcesRead as unknown as Json,
      sources_used_count: sourcesUsedRaw.length,
      prompt_tokens: result.usage.prompt_tokens,
      completion_tokens: result.usage.completion_tokens,
      model_used: result.model,
      cache_hit: false,
    })
    .select()
    .single();

  if (insertErr || !inserted) {
    return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'Failed to save output', 500));
  }

  void admin
    .rpc('increment_token_usage', {
      p_user_id: user.userId,
      p_date: todayDateString(),
      p_tokens: result.usage.total_tokens,
    })
    .then(
      () => undefined,
      () => undefined,
    );

  return c.json({
    request_id: requestId,
    cache_hit: false,
    course_id: body.course_id,
    output_format: body.output_format,
    depth: body.depth,
    output: obj,
    sources_read: sourcesRead,
    sources_used_count: sourcesUsedRaw.length,
    usage: {
      prompt_tokens: result.usage.prompt_tokens,
      completion_tokens: result.usage.completion_tokens,
      total_tokens: result.usage.total_tokens,
      estimated_cost_usd: Number(
        estimateCostUsd(result.usage.prompt_tokens, result.usage.completion_tokens).toFixed(6),
      ),
      model: result.model,
    },
    generated_at: inserted.created_at,
  });
});
