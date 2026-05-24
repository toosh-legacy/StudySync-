import { vi } from 'vitest';
import { MockDb } from './helpers/mockSupabase.js';

// Default env so modules that read process.env at import don't throw during tests.
// Real values are never needed: Supabase/OpenAI/Upstash are mocked below.
process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY ??= 'test-anon-key-aaaaaaaaaaaaaaaaaaaaaaaaaaaa';
process.env.SUPABASE_SERVICE_ROLE_KEY ??=
  'test-service-role-key-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
process.env.OPENAI_API_KEY ??= 'sk-test';
process.env.WEB_APP_URL ??= 'http://localhost:3000';
process.env.API_PUBLIC_URL ??= 'http://localhost:3001';

export const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';

// ---- Shared, test-controllable mock state (lives on globalThis so the hoisted
// vi.mock factories below and the per-test helpers reference the same objects) ----

interface GenControl {
  impl: (opts: any) => Promise<any>;
  streamImpl: (opts: any) => AsyncGenerator<any, any, void>;
}

const g = globalThis as any;

g.__mockDb = new MockDb();

g.__verifyJwt = (token: string) =>
  token === 'valid-jwt' ? { userId: TEST_USER_ID } : null;

g.__rateLimit = { success: true };
g.__apiRateLimit = { success: true };

function defaultGenResult(opts: any) {
  return {
    raw: JSON.stringify({
      result: 'ok',
      format: opts.format,
      depth: opts.depth,
      comprehension: opts.comprehension,
      sources_used: opts.sources.map((s: any) => ({
        source_name: s.source_name,
        relevance_note: 'used',
      })),
    }),
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    model: opts.model ?? 'gpt-4o-mini',
  };
}

function makeDefaultGen(): GenControl {
  return {
    impl: async (opts: any) => defaultGenResult(opts),
    streamImpl: async function* (opts: any) {
      yield { delta: '{"result":' };
      yield { delta: '"ok"}' };
      return {
        raw: JSON.stringify({
          result: 'ok',
          sources_used: opts.sources.map((s: any) => ({
            source_name: s.source_name,
            relevance_note: 'used',
          })),
        }),
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        model: opts.model ?? 'gpt-4o-mini',
      };
    },
  };
}

g.__gen = makeDefaultGen();
g.__resetGen = () => {
  g.__gen = makeDefaultGen();
};

vi.mock('../src/lib/supabase.js', () => ({
  createAdminClient: () => (globalThis as any).__mockDb.client(),
  verifyJwt: async (token: string) => (globalThis as any).__verifyJwt(token),
}));

vi.mock('../src/lib/ratelimit.js', () => ({
  generateLimiter: {
    limit: async () => ({
      success: (globalThis as any).__rateLimit.success,
      limit: 10,
      remaining: 9,
      reset: 0,
      pending: Promise.resolve(),
    }),
  },
  generateLimiterFor: () => ({
    limit: async () => ({
      success: (globalThis as any).__rateLimit.success,
      limit: 10,
      remaining: 9,
      reset: 0,
      pending: Promise.resolve(),
    }),
  }),
  apiLimiter: {
    limit: async () => ({
      success: (globalThis as any).__apiRateLimit.success,
      limit: 60,
      remaining: 59,
      reset: 0,
      pending: Promise.resolve(),
    }),
  },
}));

vi.mock('../src/lib/openai/generate.js', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    callGenerate: (opts: any) => (globalThis as any).__gen.impl(opts),
    callGenerateStream: (opts: any) => (globalThis as any).__gen.streamImpl(opts),
  };
});
