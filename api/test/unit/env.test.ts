import { describe, it, expect, afterEach } from 'vitest';
import { checkEnv } from '../../src/lib/env.js';

const KEYS = [
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('checkEnv', () => {
  it('passes when all required vars are present', () => {
    const r = checkEnv();
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('reports a missing required var', () => {
    delete process.env.OPENAI_API_KEY;
    const r = checkEnv();
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('OPENAI_API_KEY');
  });

  it('accepts the NEXT_PUBLIC fallback for the supabase url', () => {
    delete process.env.SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    expect(checkEnv().ok).toBe(true);
  });
});
