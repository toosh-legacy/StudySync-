import { getOpenAI } from './client.js';
import {
  SYSTEM_PROMPTS,
  DEPTH_INSTRUCTIONS,
  COMPREHENSION_INSTRUCTIONS,
  type OutputFormat,
  type Depth,
  type Comprehension,
} from './prompts.js';
import { DEFAULT_MODEL } from './models.js';
import { responseFormatFor } from './schemas.js';

export interface GenerateSource {
  provider: string;
  source_name: string;
  content: string;
}

export interface GenerateOptions {
  format: OutputFormat;
  depth: Depth;
  comprehension: Comprehension;
  sources: GenerateSource[];
  courseName: string;
  model?: string;
  userPrompt?: string;
  retryHint?: string;
}

export interface CallGenerateResult {
  raw: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

function buildUserMessage(opts: GenerateOptions): string {
  const blocks = opts.sources
    .map(
      (s, i) =>
        `--- SOURCE ${i + 1} (${s.provider}: ${s.source_name}) ---\n${s.content}`,
    )
    .join('\n\n');

  return [
    `Course: ${opts.courseName}`,
    `Output format: ${opts.format}`,
    `Depth instruction: ${DEPTH_INSTRUCTIONS[opts.depth]}`,
    `Audience level: ${COMPREHENSION_INSTRUCTIONS[opts.comprehension]}`,
    opts.userPrompt ? `User request: ${opts.userPrompt}` : null,
    opts.retryHint ? `IMPORTANT: ${opts.retryHint}` : null,
    '\nSource content:',
    blocks,
  ]
    .filter(Boolean)
    .join('\n');
}

async function callOnce(opts: GenerateOptions): Promise<CallGenerateResult> {
  const openai = getOpenAI();
  const model = opts.model ?? DEFAULT_MODEL;
  const response = await openai.chat.completions.create({
    model,
    max_tokens: 4096,
    temperature: 0.3,
    response_format: responseFormatFor(opts.format),
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS[opts.format] },
      { role: 'user', content: buildUserMessage(opts) },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? '';
  const usage = response.usage;
  return {
    raw,
    usage: {
      prompt_tokens: usage?.prompt_tokens ?? 0,
      completion_tokens: usage?.completion_tokens ?? 0,
      total_tokens: usage?.total_tokens ?? 0,
    },
    model: response.model ?? model,
  };
}

export async function callGenerate(
  opts: GenerateOptions,
): Promise<CallGenerateResult> {
  try {
    return await callOnce(opts);
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 429) {
      await new Promise((r) => setTimeout(r, 1000));
      return callOnce(opts);
    }
    throw err;
  }
}

export interface StreamEvent {
  delta: string;
}

export interface StreamResult {
  raw: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

/**
 * Streaming generation. Yields raw token deltas as they arrive, then returns the
 * accumulated text + usage via the returned promise's resolution embedded in the
 * final yielded value (consumer accumulates `delta`s and reads `done`).
 */
export async function* callGenerateStream(
  opts: GenerateOptions,
): AsyncGenerator<StreamEvent, StreamResult, void> {
  const openai = getOpenAI();
  const model = opts.model ?? DEFAULT_MODEL;
  const stream = await openai.chat.completions.create({
    model,
    max_tokens: 4096,
    temperature: 0.3,
    response_format: responseFormatFor(opts.format),
    stream: true,
    stream_options: { include_usage: true },
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS[opts.format] },
      { role: 'user', content: buildUserMessage(opts) },
    ],
  });

  let raw = '';
  let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  let resolvedModel = model;

  for await (const chunk of stream) {
    if (chunk.model) resolvedModel = chunk.model;
    const delta = chunk.choices[0]?.delta?.content ?? '';
    if (delta) {
      raw += delta;
      yield { delta };
    }
    if (chunk.usage) {
      usage = {
        prompt_tokens: chunk.usage.prompt_tokens ?? 0,
        completion_tokens: chunk.usage.completion_tokens ?? 0,
        total_tokens: chunk.usage.total_tokens ?? 0,
      };
    }
  }

  return { raw, usage, model: resolvedModel };
}

// Re-exported for tests and callers that build messages directly.
export { buildUserMessage };
