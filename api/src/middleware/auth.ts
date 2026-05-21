import { createHash } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { createAdminClient, verifyJwt } from '../lib/supabase.js';
import { apiError, ErrorCode } from '../lib/errors.js';

export interface AuthenticatedUser {
  userId: string;
  plan: string;
  method: 'jwt' | 'api_key';
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
      .select('id, user_id, plan, expires_at, revoked')
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
