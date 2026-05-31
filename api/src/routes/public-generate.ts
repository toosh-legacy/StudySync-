import { Hono } from 'hono';
import OpenAI from 'openai';
import { z } from 'zod';
import { apiError, ErrorCode } from '../lib/errors.js';
import { parseJson, sendError } from '../lib/http.js';
import {
  SYSTEM_PROMPTS,
  DEPTH_INSTRUCTIONS,
  type OutputFormat,
  type Depth,
} from '../lib/openai/prompts.js';
import { responseFormatFor } from '../lib/openai/schemas.js';

export const publicGenerateRouter = new Hono();

const CONTENT_LIMIT = 300_000;
const DEFAULT_MODEL = 'gpt-4o-mini';

const bodySchema = z.object({
  llm_key: z.string().min(20, 'llm_key is required'),
  content: z.string().min(1).max(CONTENT_LIMIT),
  output_format: z.enum([
    'flashcards',
    'study_guide',
    'notes',
    'practice_questions',
    'summary',
    'mind_map',
  ]),
  depth: z.enum(['quick', 'standard', 'deep']).optional().default('standard'),
  user_prompt: z.string().max(1000).optional(),
  model: z.string().optional(),
});

publicGenerateRouter.post('/', async (c) => {
  const parsed = await parseJson(c, bodySchema);
  if ('error' in parsed) return sendError(c, parsed.error);
  const body = parsed.data;

  const format = body.output_format as OutputFormat;
  const depth = body.depth as Depth;
  const model = body.model ?? DEFAULT_MODEL;

  const userMessage = [
    `Output format: ${format}`,
    `Depth instruction: ${DEPTH_INSTRUCTIONS[depth]}`,
    body.user_prompt ? `User request: ${body.user_prompt}` : null,
    '\nSource content:',
    body.content,
  ]
    .filter(Boolean)
    .join('\n');

  const openai = new OpenAI({ apiKey: body.llm_key, timeout: 60_000, maxRetries: 1 });

  let response;
  try {
    response = await openai.chat.completions.create({
      model,
      max_tokens: 4096,
      temperature: 0.3,
      response_format: responseFormatFor(format),
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[format] },
        { role: 'user', content: userMessage },
      ],
    });
  } catch (err) {
    const status = (err as { status?: number })?.status;
    const message = err instanceof Error ? err.message : 'LLM call failed';
    if (status === 401) {
      return sendError(c, apiError(ErrorCode.UNAUTHORIZED, 'Invalid llm_key', 401));
    }
    if (status === 429) {
      return sendError(c, apiError(ErrorCode.RATE_LIMITED, message, 429));
    }
    return sendError(c, apiError(ErrorCode.AI_UNAVAILABLE, message, 503));
  }

  const raw = response.choices[0]?.message?.content ?? '';
  let output: unknown;
  try {
    output = JSON.parse(raw);
  } catch {
    return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'LLM returned invalid JSON', 502));
  }

  if (output && typeof output === 'object') {
    delete (output as Record<string, unknown>).sources_used;
  }

  return c.json({
    output_format: format,
    depth,
    output,
    usage: {
      prompt_tokens: response.usage?.prompt_tokens ?? 0,
      completion_tokens: response.usage?.completion_tokens ?? 0,
      total_tokens: response.usage?.total_tokens ?? 0,
      model: response.model ?? model,
    },
  });
});
