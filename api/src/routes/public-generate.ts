import { Hono } from 'hono';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { apiError, ErrorCode } from '../lib/errors.js';
import { parseJson, sendError } from '../lib/http.js';
import {
  SYSTEM_PROMPTS,
  DEPTH_INSTRUCTIONS,
  type OutputFormat,
  type Depth,
} from '../lib/openai/prompts.js';
import { responseFormatFor, RESPONSE_SCHEMAS } from '../lib/openai/schemas.js';

export const publicGenerateRouter = new Hono();

const CONTENT_LIMIT = 300_000;
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

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

type Provider = 'anthropic' | 'openai';

function detectProvider(key: string): Provider {
  return key.startsWith('sk-ant-') ? 'anthropic' : 'openai';
}

function buildUserMessage(
  format: OutputFormat,
  depth: Depth,
  content: string,
  userPrompt: string | undefined,
): string {
  return [
    `Output format: ${format}`,
    `Depth instruction: ${DEPTH_INSTRUCTIONS[depth]}`,
    userPrompt ? `User request: ${userPrompt}` : null,
    '\nSource content:',
    content,
  ]
    .filter(Boolean)
    .join('\n');
}

interface GenResult {
  output: unknown;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    model: string;
  };
}

async function runOpenAI(
  key: string,
  model: string,
  format: OutputFormat,
  userMessage: string,
): Promise<GenResult> {
  const openai = new OpenAI({ apiKey: key, timeout: 60_000, maxRetries: 1 });
  const response = await openai.chat.completions.create({
    model,
    max_tokens: 4096,
    temperature: 0.3,
    response_format: responseFormatFor(format),
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS[format] },
      { role: 'user', content: userMessage },
    ],
  });
  const raw = response.choices[0]?.message?.content ?? '';
  return {
    output: JSON.parse(raw),
    usage: {
      prompt_tokens: response.usage?.prompt_tokens ?? 0,
      completion_tokens: response.usage?.completion_tokens ?? 0,
      total_tokens: response.usage?.total_tokens ?? 0,
      model: response.model ?? model,
    },
  };
}

async function runAnthropic(
  key: string,
  model: string,
  format: OutputFormat,
  userMessage: string,
): Promise<GenResult> {
  const anthropic = new Anthropic({ apiKey: key, timeout: 60_000, maxRetries: 1 });
  // Force structured JSON by defining a single tool whose input_schema is the
  // format schema and forcing tool_choice to that tool.
  const toolName = `emit_${format}`;
  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    temperature: 0.3,
    system: SYSTEM_PROMPTS[format],
    tools: [
      {
        name: toolName,
        description: `Emit the ${format} output.`,
        input_schema: RESPONSE_SCHEMAS[format] as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: 'tool', name: toolName },
    messages: [{ role: 'user', content: userMessage }],
  });
  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Anthropic did not return a tool_use block');
  }
  return {
    output: toolUse.input,
    usage: {
      prompt_tokens: response.usage.input_tokens,
      completion_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      model: response.model,
    },
  };
}

publicGenerateRouter.post('/', async (c) => {
  const parsed = await parseJson(c, bodySchema);
  if ('error' in parsed) return sendError(c, parsed.error);
  const body = parsed.data;

  const format = body.output_format as OutputFormat;
  const depth = body.depth as Depth;
  const provider = detectProvider(body.llm_key);
  const model =
    body.model ?? (provider === 'anthropic' ? DEFAULT_ANTHROPIC_MODEL : DEFAULT_OPENAI_MODEL);

  const userMessage = buildUserMessage(format, depth, body.content, body.user_prompt);

  let result: GenResult;
  try {
    result =
      provider === 'anthropic'
        ? await runAnthropic(body.llm_key, model, format, userMessage)
        : await runOpenAI(body.llm_key, model, format, userMessage);
  } catch (err) {
    const status = (err as { status?: number })?.status;
    const message = err instanceof Error ? err.message : 'LLM call failed';
    if (status === 401) {
      return sendError(c, apiError(ErrorCode.UNAUTHORIZED, 'Invalid llm_key', 401));
    }
    if (status === 429) {
      return sendError(c, apiError(ErrorCode.RATE_LIMITED, message, 429));
    }
    if (err instanceof SyntaxError) {
      return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'LLM returned invalid JSON', 502));
    }
    return sendError(c, apiError(ErrorCode.AI_UNAVAILABLE, message, 503));
  }

  if (result.output && typeof result.output === 'object') {
    delete (result.output as Record<string, unknown>).sources_used;
  }

  return c.json({
    output_format: format,
    depth,
    provider,
    output: result.output,
    usage: result.usage,
  });
});
