import { getOpenAI } from './client.js';
import {
  SYSTEM_PROMPTS,
  DEPTH_INSTRUCTIONS,
  type OutputFormat,
} from './prompts.js';

const MODEL = 'gpt-4o-mini';

export interface GenerateSource {
  provider: string;
  source_name: string;
  content: string;
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

function buildUserMessage(
  courseName: string,
  format: OutputFormat,
  depth: keyof typeof DEPTH_INSTRUCTIONS,
  sources: GenerateSource[],
  userPrompt?: string,
  retryHint?: string,
) {
  const blocks = sources
    .map(
      (s, i) =>
        `--- SOURCE ${i + 1} (${s.provider}: ${s.source_name}) ---\n${s.content}`,
    )
    .join('\n\n');

  return [
    `Course: ${courseName}`,
    `Output format: ${format}`,
    `Depth instruction: ${DEPTH_INSTRUCTIONS[depth]}`,
    userPrompt ? `User request: ${userPrompt}` : null,
    retryHint ? `IMPORTANT: ${retryHint}` : null,
    '\nSource content:',
    blocks,
  ]
    .filter(Boolean)
    .join('\n');
}

async function callOnce(
  format: OutputFormat,
  userMessage: string,
): Promise<CallGenerateResult> {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS[format] },
      { role: 'user', content: userMessage },
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
    model: response.model ?? MODEL,
  };
}

export async function callGenerate(
  format: OutputFormat,
  depth: keyof typeof DEPTH_INSTRUCTIONS,
  sources: GenerateSource[],
  courseName: string,
  userPrompt?: string,
  retryHint?: string,
): Promise<CallGenerateResult> {
  const userMessage = buildUserMessage(
    courseName,
    format,
    depth,
    sources,
    userPrompt,
    retryHint,
  );

  try {
    return await callOnce(format, userMessage);
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 429) {
      await new Promise((r) => setTimeout(r, 1000));
      return callOnce(format, userMessage);
    }
    throw err;
  }
}
