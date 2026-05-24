import { createApp } from '../../src/app.js';
import type { MockDb } from './mockSupabase.js';
import { TEST_USER_ID } from '../setup.js';

const g = globalThis as any;

export { TEST_USER_ID };
export const app = createApp();

export function db(): MockDb {
  return g.__mockDb as MockDb;
}

/** Reset all mock state and seed a profile for the default test user. */
export function resetMocks() {
  const mock = db();
  mock.tables.clear();
  mock.errors.clear();
  mock.rpcCalls = [];
  mock.rpcHandlers.clear();
  mock.seed('profiles', [
    { id: TEST_USER_ID, plan: 'free', display_name: 'Tester', avatar_url: null },
  ]);
  // Atomic budget check: allowed when today's usage is under budget.
  mock.onRpc('check_budget_and_lock', (args: any) => {
    const rows = mock.get('token_usage');
    const row = rows.find(
      (r) => r.user_id === args.p_user_id && r.date === args.p_date,
    );
    const used = row?.tokens_used ?? 0;
    return { data: used < args.p_budget, error: null };
  });
  g.__verifyJwt = (token: string) =>
    token === 'valid-jwt' ? { userId: TEST_USER_ID } : null;
  g.__rateLimit = { success: true };
  g.__apiRateLimit = { success: true };
  g.__resetGen();
}

export function setApiRateLimit(success: boolean) {
  g.__apiRateLimit = { success };
}

/** Set the plan for the seeded test user. */
export function setPlan(plan: string) {
  const profiles = db().get('profiles');
  if (profiles[0]) profiles[0].plan = plan;
}

export function setRateLimit(success: boolean) {
  g.__rateLimit = { success };
}

export function setGenerate(impl: (opts: any) => Promise<any>) {
  g.__gen.impl = impl;
}

export function setGenerateStream(impl: (opts: any) => AsyncGenerator<any, any, void>) {
  g.__gen.streamImpl = impl;
}

/** Default authenticated request headers (valid JWT). */
export function auth(extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: 'Bearer valid-jwt', ...extra };
}

/** Convenience: JSON POST/PATCH request init with auth. */
export function jsonReq(
  method: string,
  body: unknown,
  headers: Record<string, string> = {},
): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json', ...auth(headers) },
    body: JSON.stringify(body),
  };
}
