import OpenAI from 'openai';

let client: OpenAI | undefined;

export function getOpenAI(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  // Bounded timeout + a couple of automatic retries for transient network/5xx
  // errors. The generate route adds its own one-shot 429 retry on top.
  client = new OpenAI({ apiKey, timeout: 60_000, maxRetries: 2 });
  return client;
}
