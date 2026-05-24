import { randomUUID, createHash } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { streamSSE } from 'hono/streaming';
import { requireAuth, requireScope } from '../middleware/auth.js';
import { createAdminClient } from '../lib/supabase.js';
import { apiError, ErrorCode, type ApiErrorPayload } from '../lib/errors.js';
import { getUser, parseJson, sendError } from '../lib/http.js';
import { buildCacheKey } from '../lib/cache.js';
import { generateLimiter, generateLimiterFor } from '../lib/ratelimit.js';
import { callGenerate, callGenerateStream } from '../lib/openai/generate.js';
import type { GenerateSource } from '../lib/openai/generate.js';
import {
  retrieveRelevant,
  RETRIEVAL_CHAR_THRESHOLD,
  type RetrievalInfo,
} from '../lib/openai/embed.js';
import { DEFAULT_MODEL, planAllowsModel } from '../lib/openai/models.js';
import { estimateCostUsd, planBudget } from '../lib/billing.js';
import {
  generateRequestSchema,
  generateJobSchema,
  type GenerateRequest,
  type GenerateJobRequest,
} from '../types/api.js';
import { deliverWebhook } from '../lib/webhook.js';
import { dispatchJob, verifyQstashSignature } from '../lib/queue.js';
import type { AuthenticatedUser } from '../middleware/auth.js';
import type { Json } from '../types/database.js';

export const generateRouter = new Hono();
generateRouter.use('*', requireAuth);

const TOTAL_CHAR_LIMIT = 300_000;

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const midnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(1, Math.ceil((midnight - now.getTime()) / 1000));
}

interface PreparedOk {
  ok: true;
  body: GenerateRequest;
  model: string;
  course: { id: string; name: string };
  cacheKey: string;
  cached: Record<string, unknown> | null;
}
interface PreparedErr {
  ok: false;
  error: ApiErrorPayload;
}

/**
 * HTTP pre-flight: per-user (or per-key) rate limit + JSON body validation, then
 * the shared validation. Used by the synchronous POST endpoints.
 */
async function prepare(
  c: Context,
  user: AuthenticatedUser,
): Promise<PreparedOk | PreparedErr> {
  const limiter =
    user.rateLimitPerMin != null ? generateLimiterFor(user.rateLimitPerMin) : generateLimiter;
  const limit = await limiter.limit(`gen:${user.userId}`);
  if (!limit.success) {
    return {
      ok: false,
      error: apiError(
        ErrorCode.RATE_LIMITED,
        'Too many generation requests. Please slow down.',
        429,
        { retry_after: 60 },
      ),
    };
  }

  const parsed = await parseJson(c, generateRequestSchema);
  if ('error' in parsed) return { ok: false, error: parsed.error };
  return prepareValidated(user, parsed.data);
}

/**
 * Context-free validation shared by the sync endpoints and the async job worker:
 * model gating, char limit, course ownership, cache lookup, and the atomic budget
 * check. No rate limiting or request parsing.
 */
async function prepareValidated(
  user: AuthenticatedUser,
  body: GenerateRequest,
): Promise<PreparedOk | PreparedErr> {
  const model = body.model ?? DEFAULT_MODEL;
  if (!planAllowsModel(user.plan, model)) {
    return {
      ok: false,
      error: apiError(
        ErrorCode.FORBIDDEN,
        `Model "${model}" is not available on the ${user.plan} plan.`,
        403,
      ),
    };
  }

  const totalChars = body.sources.reduce((sum, s) => sum + s.content.length, 0);
  if (totalChars > TOTAL_CHAR_LIMIT) {
    return {
      ok: false,
      error: apiError(
        ErrorCode.VALIDATION_ERROR,
        `Total source content exceeds ${TOTAL_CHAR_LIMIT.toLocaleString()} characters`,
        422,
      ),
    };
  }

  const admin = createAdminClient();
  const { data: course } = await admin
    .from('courses')
    .select('id, name')
    .eq('id', body.course_id)
    .eq('user_id', user.userId)
    .maybeSingle();
  if (!course) {
    return { ok: false, error: apiError(ErrorCode.NOT_FOUND, 'Course not found', 404) };
  }

  const cacheKey = buildCacheKey({
    courseId: body.course_id,
    format: body.output_format,
    depth: body.depth,
    comprehension: body.comprehension,
    model,
    sourceContents: body.sources.map((s) => s.content),
  });

  const { data: cached } = await admin
    .from('generated_outputs')
    .select('*')
    .eq('cache_key', cacheKey)
    .eq('user_id', user.userId)
    .maybeSingle();

  if (!cached) {
    // Only enforce the daily budget when we actually need to call the model.
    // The effective budget is the plan budget, optionally tightened by a per-key
    // daily token quota. The check is done in an atomic, row-locking RPC so two
    // concurrent generations can't both slip past an already-exhausted budget.
    const planLimit = planBudget(user.plan);
    const budget =
      user.dailyTokenQuota != null ? Math.min(planLimit, user.dailyTokenQuota) : planLimit;
    const { data: allowed } = await admin.rpc('check_budget_and_lock', {
      p_user_id: user.userId,
      p_date: todayDateString(),
      p_budget: budget,
    });
    if (allowed === false) {
      return {
        ok: false,
        error: apiError(
          ErrorCode.BUDGET_EXHAUSTED,
          `Daily token budget exceeded (limit ${budget}).`,
          429,
          { retry_after: secondsUntilUtcMidnight() },
        ),
      };
    }
  }

  return {
    ok: true,
    body,
    model,
    course: course as { id: string; name: string },
    cacheKey,
    cached: (cached as Record<string, unknown> | null) ?? null,
  };
}

function buildSourcesRead(body: GenerateRequest, sourcesUsedRaw: Array<{ source_name?: string; relevance_note?: string }>) {
  return body.sources.map((s) => {
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
}

function splitSourcesUsed(parsedOutput: unknown) {
  const obj =
    parsedOutput && typeof parsedOutput === 'object'
      ? (parsedOutput as Record<string, unknown>)
      : {};
  const sourcesUsedRaw = Array.isArray(obj.sources_used)
    ? (obj.sources_used as Array<{ source_name?: string; relevance_note?: string }>)
    : [];
  delete obj.sources_used;
  return { obj, sourcesUsedRaw };
}

interface PersistArgs {
  userId: string;
  body: GenerateRequest;
  cacheKey: string;
  model: string;
  obj: Record<string, unknown>;
  sourcesRead: ReturnType<typeof buildSourcesRead>;
  sourcesUsedCount: number;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

async function persistOutput(args: PersistArgs) {
  const admin = createAdminClient();
  const requestId = randomUUID();
  const { data: inserted, error: insertErr } = await admin
    .from('generated_outputs')
    .insert({
      id: requestId,
      user_id: args.userId,
      course_id: args.body.course_id,
      cache_key: args.cacheKey,
      output_format: args.body.output_format,
      depth: args.body.depth,
      comprehension: args.body.comprehension,
      output: args.obj as Json,
      sources_read: args.sourcesRead as unknown as Json,
      sources_used_count: args.sourcesUsedCount,
      prompt_tokens: args.usage.prompt_tokens,
      completion_tokens: args.usage.completion_tokens,
      model_used: args.model,
      cache_hit: false,
    })
    .select()
    .single();

  if (insertErr || !inserted) return null;

  void admin
    .rpc('increment_token_usage', {
      p_user_id: args.userId,
      p_date: todayDateString(),
      p_tokens: args.usage.total_tokens,
    })
    .then(
      () => undefined,
      () => undefined,
    );

  return inserted as Record<string, unknown>;
}

function cachedResponse(cached: Record<string, unknown>) {
  const promptTokens = (cached.prompt_tokens as number) ?? 0;
  const completionTokens = (cached.completion_tokens as number) ?? 0;
  return {
    request_id: cached.id,
    cache_hit: true,
    course_id: cached.course_id,
    output_format: cached.output_format,
    depth: cached.depth,
    comprehension: cached.comprehension ?? 'intermediate',
    output: cached.output,
    sources_read: cached.sources_read,
    sources_used_count: cached.sources_used_count,
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
      estimated_cost_usd: 0,
      model: (cached.model_used as string) ?? DEFAULT_MODEL,
    },
    generated_at: cached.created_at,
  };
}

/** Build the OpenAI generation options from a validated request + resolved sources. */
function genOpts(
  body: GenerateRequest,
  courseName: string,
  model: string,
  sources: GenerateSource[],
  retryHint?: string,
) {
  return {
    format: body.output_format,
    depth: body.depth,
    comprehension: body.comprehension,
    sources,
    courseName,
    model,
    userPrompt: body.user_prompt,
    ...(retryHint ? { retryHint } : {}),
  };
}

/**
 * Resolve the content to send to the model: pass sources through as-is, or, when
 * the combined size is large, reduce to the most query-relevant chunks via
 * embedding retrieval. Cache key and sources_read stay based on the originals.
 */
async function resolveSources(
  body: GenerateRequest,
  courseName: string,
): Promise<{ sources: GenerateSource[]; retrieval: RetrievalInfo | null }> {
  const mapped: GenerateSource[] = body.sources.map((s) => ({
    provider: s.provider,
    source_name: s.source_name,
    content: s.content,
  }));
  const total = mapped.reduce((n, s) => n + s.content.length, 0);
  if (total <= RETRIEVAL_CHAR_THRESHOLD) return { sources: mapped, retrieval: null };

  const query = [courseName, body.user_prompt ?? '', `study ${body.output_format}`]
    .filter(Boolean)
    .join(' — ');
  const { sources, info } = await retrieveRelevant(mapped, query);
  return { sources, retrieval: info };
}

const JSON_RETRY_HINT =
  'Your previous response was not valid JSON. Return only a valid JSON object matching the schema.';

/** Stable hash of the meaningful request fields, for idempotency-key validation. */
function idempotencyHash(body: GenerateRequest, model: string): string {
  const canonical = JSON.stringify({
    course_id: body.course_id,
    output_format: body.output_format,
    depth: body.depth,
    comprehension: body.comprehension,
    model,
    user_prompt: body.user_prompt ?? null,
    sources: body.sources.map((s) => ({
      provider: s.provider,
      source_name: s.source_name,
      content: s.content,
    })),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Run the generation pipeline for an already-validated request. Context-free so
 * it is shared by the sync POST endpoint and the async job worker. Returns the
 * full response payload (cached or freshly generated) or an error.
 */
async function executeGeneration(
  user: AuthenticatedUser,
  prep: PreparedOk,
): Promise<{ ok: true; response: Record<string, unknown> } | { ok: false; error: ApiErrorPayload }> {
  const { body, model, course, cacheKey, cached } = prep;
  if (cached) return { ok: true, response: cachedResponse(cached) };

  let genSources: GenerateSource[];
  let retrieval: RetrievalInfo | null;
  try {
    ({ sources: genSources, retrieval } = await resolveSources(body, course.name));
  } catch (err) {
    return { ok: false, error: mapGenerateError(err) };
  }

  let result;
  try {
    result = await callGenerate(genOpts(body, course.name, model, genSources));
  } catch (err) {
    return { ok: false, error: mapGenerateError(err) };
  }

  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(result.raw);
  } catch {
    try {
      result = await callGenerate(genOpts(body, course.name, model, genSources, JSON_RETRY_HINT));
      parsedOutput = JSON.parse(result.raw);
    } catch {
      return {
        ok: false,
        error: apiError(ErrorCode.INTERNAL_ERROR, 'Could not parse AI response', 500),
      };
    }
  }

  const { obj, sourcesUsedRaw } = splitSourcesUsed(parsedOutput);
  const sourcesRead = buildSourcesRead(body, sourcesUsedRaw);

  const inserted = await persistOutput({
    userId: user.userId,
    body,
    cacheKey,
    model: result.model,
    obj,
    sourcesRead,
    sourcesUsedCount: sourcesUsedRaw.length,
    usage: result.usage,
  });
  if (!inserted) {
    return { ok: false, error: apiError(ErrorCode.INTERNAL_ERROR, 'Failed to save output', 500) };
  }

  const response: Record<string, unknown> = {
    request_id: inserted.id,
    cache_hit: false,
    course_id: body.course_id,
    output_format: body.output_format,
    depth: body.depth,
    comprehension: body.comprehension,
    output: obj,
    sources_read: sourcesRead,
    sources_used_count: sourcesUsedRaw.length,
    ...(retrieval ? { retrieval } : {}),
    usage: {
      prompt_tokens: result.usage.prompt_tokens,
      completion_tokens: result.usage.completion_tokens,
      total_tokens: result.usage.total_tokens,
      estimated_cost_usd: Number(
        estimateCostUsd(
          result.usage.prompt_tokens,
          result.usage.completion_tokens,
          result.model,
        ).toFixed(6),
      ),
      model: result.model,
    },
    generated_at: inserted.created_at,
  };
  return { ok: true, response };
}

generateRouter.post('/', requireScope('generate:write'), async (c) => {
  const user = getUser(c);
  const prep = await prepare(c, user);
  if (!prep.ok) return sendError(c, prep.error);

  // Idempotency: replay a stored response for a repeated Idempotency-Key.
  const idemKey = c.req.header('idempotency-key') ?? null;
  const reqHash = idemKey ? idempotencyHash(prep.body, prep.model) : '';
  if (idemKey) {
    const { data: existing } = await createAdminClient()
      .from('idempotency_keys')
      .select('request_hash, response')
      .eq('user_id', user.userId)
      .eq('idempotency_key', idemKey)
      .maybeSingle();
    if (existing) {
      if (existing.request_hash !== reqHash) {
        return sendError(
          c,
          apiError(
            ErrorCode.VALIDATION_ERROR,
            'Idempotency-Key was already used with a different request body',
            409,
          ),
        );
      }
      return c.json(existing.response as Record<string, unknown>);
    }
  }

  const exec = await executeGeneration(user, prep);
  if (!exec.ok) return sendError(c, exec.error);

  if (idemKey) {
    void createAdminClient()
      .from('idempotency_keys')
      .insert({
        user_id: user.userId,
        idempotency_key: idemKey,
        request_hash: reqHash,
        response: exec.response as unknown as Json,
      })
      .then(
        () => undefined,
        () => undefined,
      );
  }

  return c.json(exec.response);
});

generateRouter.post('/stream', requireScope('generate:write'), async (c) => {
  const user = getUser(c);
  const prep = await prepare(c, user);
  if (!prep.ok) return sendError(c, prep.error);
  const { body, model, course, cacheKey, cached } = prep;

  return streamSSE(c, async (stream) => {
    if (cached) {
      await stream.writeSSE({ event: 'meta', data: JSON.stringify({ cache_hit: true }) });
      await stream.writeSSE({ event: 'done', data: JSON.stringify(cachedResponse(cached)) });
      return;
    }

    await stream.writeSSE({
      event: 'meta',
      data: JSON.stringify({ cache_hit: false, output_format: body.output_format, model }),
    });

    let raw = '';
    let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    let resolvedModel = model;
    try {
      const { sources: genSources } = await resolveSources(body, course.name);
      const gen = callGenerateStream(genOpts(body, course.name, model, genSources));
      let next = await gen.next();
      while (!next.done) {
        await stream.writeSSE({ event: 'delta', data: JSON.stringify(next.value) });
        next = await gen.next();
      }
      raw = next.value.raw;
      usage = next.value.usage;
      resolvedModel = next.value.model;
    } catch (err) {
      const mapped = mapGenerateError(err);
      await stream.writeSSE({ event: 'error', data: JSON.stringify(mapped.body) });
      return;
    }

    let parsedOutput: unknown;
    try {
      parsedOutput = JSON.parse(raw);
    } catch {
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify(apiError(ErrorCode.INTERNAL_ERROR, 'Could not parse AI response', 500).body),
      });
      return;
    }

    const { obj, sourcesUsedRaw } = splitSourcesUsed(parsedOutput);
    const sourcesRead = buildSourcesRead(body, sourcesUsedRaw);
    const inserted = await persistOutput({
      userId: user.userId,
      body,
      cacheKey,
      model: resolvedModel,
      obj,
      sourcesRead,
      sourcesUsedCount: sourcesUsedRaw.length,
      usage,
    });

    await stream.writeSSE({
      event: 'done',
      data: JSON.stringify({
        request_id: inserted?.id ?? null,
        cache_hit: false,
        course_id: body.course_id,
        output_format: body.output_format,
        depth: body.depth,
        comprehension: body.comprehension,
        output: obj,
        sources_read: sourcesRead,
        sources_used_count: sourcesUsedRaw.length,
        usage: {
          prompt_tokens: usage.prompt_tokens,
          completion_tokens: usage.completion_tokens,
          total_tokens: usage.total_tokens,
          estimated_cost_usd: Number(
            estimateCostUsd(usage.prompt_tokens, usage.completion_tokens, resolvedModel).toFixed(6),
          ),
          model: resolvedModel,
        },
        generated_at: (inserted?.created_at as string) ?? null,
      }),
    });
  });
});

// ---- Async jobs ----

const JOB_TIMEOUT_MS = 5 * 60 * 1000;
const jobUuid = z.string().uuid();

interface JobUserCtx {
  plan: string;
  method: 'jwt' | 'api_key';
  scopes: string[];
  rateLimitPerMin: number | null;
  dailyTokenQuota: number | null;
  keyId: string | null;
}

function userCtxFrom(user: AuthenticatedUser): JobUserCtx {
  return {
    plan: user.plan,
    method: user.method,
    scopes: user.scopes,
    rateLimitPerMin: user.rateLimitPerMin,
    dailyTokenQuota: user.dailyTokenQuota,
    keyId: user.keyId,
  };
}

/**
 * Worker keyed only by job id: loads the persisted job + caller context, runs the
 * generation pipeline, stores the result, and delivers the webhook. Used by both
 * the inline dispatcher and the QStash-driven process endpoint.
 */
export async function runGenerationJob(jobId: string): Promise<void> {
  const admin = createAdminClient();
  const nowIso = () => new Date().toISOString();

  const { data: job } = await admin
    .from('generation_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();
  if (!job) return;

  await admin
    .from('generation_jobs')
    .update({ status: 'processing', updated_at: nowIso() })
    .eq('id', jobId);

  const body = job.request as unknown as GenerateJobRequest;
  const ctx = (job.user_ctx ?? {}) as Partial<JobUserCtx>;
  const user: AuthenticatedUser = {
    userId: job.user_id,
    plan: ctx.plan ?? 'free',
    method: ctx.method ?? 'api_key',
    scopes: ctx.scopes ?? ['generate:read', 'generate:write'],
    rateLimitPerMin: ctx.rateLimitPerMin ?? null,
    dailyTokenQuota: ctx.dailyTokenQuota ?? null,
    keyId: ctx.keyId ?? null,
  };

  let status: 'completed' | 'failed' = 'failed';
  let result: Record<string, unknown> | null = null;
  let error: Record<string, unknown> | null = null;
  try {
    const prep = await prepareValidated(user, body);
    if (!prep.ok) {
      error = prep.error.body;
    } else {
      const exec = await executeGeneration(user, prep);
      if (exec.ok) {
        status = 'completed';
        result = exec.response;
      } else {
        error = exec.error.body;
      }
    }
  } catch (err) {
    error = { message: err instanceof Error ? err.message : 'unknown' };
  }

  await admin
    .from('generation_jobs')
    .update({
      status,
      result: (result as unknown as Json) ?? null,
      error: (error as unknown as Json) ?? null,
      updated_at: nowIso(),
    })
    .eq('id', jobId);

  if (job.callback_url) {
    const callbackStatus = await deliverWebhook(job.callback_url, {
      job_id: jobId,
      status,
      result,
      error,
    });
    await admin
      .from('generation_jobs')
      .update({ callback_status: callbackStatus, updated_at: nowIso() })
      .eq('id', jobId);
  }
}

/** Internal endpoint: QStash delivers persisted jobs here. Not auth-gated — it is
 * verified by the QStash signature instead. Mounted outside the generate router. */
export async function jobProcessHandler(c: Context) {
  const raw = await c.req.text();
  const signature = c.req.header('upstash-signature');
  const ok = await verifyQstashSignature(signature, raw);
  if (!ok) {
    return sendError(c, apiError(ErrorCode.UNAUTHORIZED, 'Invalid or missing QStash signature', 401));
  }
  let jobId: string | undefined;
  try {
    jobId = (JSON.parse(raw) as { job_id?: string }).job_id;
  } catch {
    return sendError(c, apiError(ErrorCode.VALIDATION_ERROR, 'Invalid body', 422));
  }
  if (!jobId) return sendError(c, apiError(ErrorCode.VALIDATION_ERROR, 'Missing job_id', 422));
  await runGenerationJob(jobId);
  return c.json({ ok: true });
}

generateRouter.post('/jobs', requireScope('generate:write'), async (c) => {
  const user = getUser(c);

  const limiter =
    user.rateLimitPerMin != null ? generateLimiterFor(user.rateLimitPerMin) : generateLimiter;
  const limit = await limiter.limit(`gen:${user.userId}`);
  if (!limit.success) {
    return sendError(
      c,
      apiError(ErrorCode.RATE_LIMITED, 'Too many generation requests. Please slow down.', 429, {
        retry_after: 60,
      }),
    );
  }

  const parsed = await parseJson(c, generateJobSchema);
  if ('error' in parsed) return sendError(c, parsed.error);
  const body = parsed.data;

  const model = body.model ?? DEFAULT_MODEL;
  if (!planAllowsModel(user.plan, model)) {
    return sendError(
      c,
      apiError(ErrorCode.FORBIDDEN, `Model "${model}" is not available on the ${user.plan} plan.`, 403),
    );
  }

  const jobId = randomUUID();
  const { error } = await createAdminClient()
    .from('generation_jobs')
    .insert({
      id: jobId,
      user_id: user.userId,
      status: 'queued',
      request: body as unknown as Json,
      callback_url: body.callback_url ?? null,
      user_ctx: userCtxFrom(user) as unknown as Json,
    });
  if (error) {
    return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'Failed to create job', 500));
  }

  // Durable dispatch: QStash if configured (survives restarts, scales across
  // instances), else inline in-process with a read-time timeout reaper.
  await dispatchJob(jobId, runGenerationJob);

  return c.json({ job_id: jobId, status: 'queued' }, 202);
});

generateRouter.get('/jobs/:id', requireScope('generate:read'), async (c) => {
  const user = getUser(c);
  const id = c.req.param('id');
  if (!jobUuid.safeParse(id).success) {
    return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Job not found', 404));
  }
  const admin = createAdminClient();
  const { data: job } = await admin
    .from('generation_jobs')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.userId)
    .maybeSingle();
  if (!job) return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Job not found', 404));

  let status = job.status as string;
  let error = job.error;
  // Reaper: a job stuck in 'processing' past the timeout is marked failed.
  if (status === 'processing' && Date.now() - new Date(job.updated_at).getTime() > JOB_TIMEOUT_MS) {
    status = 'failed';
    error = { message: 'Job timed out' } as unknown as Json;
    await admin
      .from('generation_jobs')
      .update({ status: 'failed', error, updated_at: new Date().toISOString() })
      .eq('id', id);
  }

  return c.json({
    id: job.id,
    status,
    result: job.result ?? null,
    error: error ?? null,
    callback_status: job.callback_status ?? null,
    created_at: job.created_at,
    updated_at: job.updated_at,
  });
});

function mapGenerateError(err: unknown): ApiErrorPayload {
  const status = (err as { status?: number })?.status;
  if (status === 429 || status === 503) {
    return apiError(ErrorCode.AI_UNAVAILABLE, 'AI provider unavailable; please retry shortly.', 503);
  }
  const msg = err instanceof Error ? err.message : 'unknown';
  if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
    return apiError(ErrorCode.AI_UNAVAILABLE, 'AI provider unreachable.', 503);
  }
  return apiError(ErrorCode.INTERNAL_ERROR, 'Generation failed', 500);
}
