import { createHash } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { createAdminClient, verifyJwt } from '../lib/supabase.js';
import { apiError, ErrorCode } from '../lib/errors.js';

export const ALL_SCOPES = ['generate:read', 'generate:write'] as const;
export type Scope = (typeof ALL_SCOPES)[number];

export interface AuthenticatedUser {
  userId: string;
  plan: string;
  method: 'jwt' | 'api_key';
  /** Scopes granted to this caller. JWT sessions get all scopes. */
  scopes: string[];
  /** Per-key overrides (api_key method only). */
  rateLimitPerMin: number | null;
  dailyTokenQuota: number | null;
  /** The api_keys.id, for usage attribution (api_key method only). */
  keyId: string | null;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthenticatedUser;
  }
}

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

async function authenticate(c: Context): Promise<AuthenticatedUser | null> {
  const authHeader = c.req.header('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token.length > 0) {
      const verified = await verifyJwt(token);
      if (verified) {
        const admin = createAdminClient();
        const { data: profile } = await admin
          .from('profiles')
          .select('plan')
          .eq('id', verified.userId)
          .maybeSingle();
        return {
          userId: verified.userId,
          plan: profile?.plan ?? 'free',
          method: 'jwt',
          scopes: [...ALL_SCOPES],
          rateLimitPerMin: null,
          dailyTokenQuota: null,
          keyId: null,
        };
      }
    }
  }

  const apiKey = c.req.header('x-api-key');
  if (apiKey && apiKey.length >= 32) {
    const keyHash = hashApiKey(apiKey);
    const admin = createAdminClient();
    const { data: keyRow } = await admin
      .from('api_keys')
      .select('id, user_id, plan, expires_at, revoked, scopes, rate_limit_per_min, daily_token_quota')
      .eq('key_hash', keyHash)
      .eq('revoked', false)
      .maybeSingle();

    if (
      keyRow &&
      (!keyRow.expires_at || new Date(keyRow.expires_at) >= new Date())
    ) {
      void admin
        .rpc('increment_api_key_usage', { p_id: keyRow.id })
        .then(
          () => undefined,
          () => undefined,
        );
      return {
        userId: keyRow.user_id,
        plan: keyRow.plan,
        method: 'api_key',
        scopes: keyRow.scopes ?? [...ALL_SCOPES],
        rateLimitPerMin: keyRow.rate_limit_per_min ?? null,
        dailyTokenQuota: keyRow.daily_token_quota ?? null,
        keyId: keyRow.id,
      };
    }
  }

  return null;
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const user = await authenticate(c);
  if (!user) {
    const err = apiError(ErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    return c.json(err.body, 401);
  }
  c.set('user', user);
  await next();
};

/** Middleware factory enforcing that the caller holds a given scope. Must run after requireAuth. */
export function requireScope(scope: Scope): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user');
    if (!user || !user.scopes.includes(scope)) {
      const err = apiError(ErrorCode.FORBIDDEN, `Missing required scope: ${scope}`, 403);
      return c.json(err.body, 403);
    }
    await next();
  };
}
