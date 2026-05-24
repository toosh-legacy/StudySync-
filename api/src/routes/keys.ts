import { createHash, randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { createAdminClient } from '../lib/supabase.js';
import { apiError, ErrorCode } from '../lib/errors.js';
import { getUser, parseJson, sendError } from '../lib/http.js';
import { apiKeyCreateSchema } from '../types/api.js';

export const keysRouter = new Hono();
keysRouter.use('*', requireAuth);

const uuid = z.string().uuid();

keysRouter.get('/', async (c) => {
  const user = getUser(c);
  const admin = createAdminClient();
  const { data } = await admin
    .from('api_keys')
    .select(
      'id, label, key_prefix, plan, scopes, rate_limit_per_min, daily_token_quota, usage_count, last_used_at, expires_at, revoked, created_at',
    )
    .eq('user_id', user.userId)
    .order('created_at', { ascending: false });
  return c.json(data ?? []);
});

keysRouter.post('/', async (c) => {
  const user = getUser(c);
  if (user.method === 'api_key') {
    return sendError(c, apiError(ErrorCode.FORBIDDEN, 'API keys cannot create other API keys', 403));
  }

  const parsed = await parseJson(c, apiKeyCreateSchema);
  if ('error' in parsed) return sendError(c, parsed.error);

  const raw = `ss_live_${randomBytes(32).toString('hex')}`;
  const keyHash = createHash('sha256').update(raw).digest('hex');
  const prefix = raw.slice(0, 16);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('api_keys')
    .insert({
      user_id: user.userId,
      label: parsed.data.label,
      key_hash: keyHash,
      key_prefix: prefix,
      plan: user.plan,
      expires_at: parsed.data.expires_at ?? null,
      ...(parsed.data.scopes ? { scopes: parsed.data.scopes } : {}),
      ...(parsed.data.rate_limit_per_min != null
        ? { rate_limit_per_min: parsed.data.rate_limit_per_min }
        : {}),
      ...(parsed.data.daily_token_quota != null
        ? { daily_token_quota: parsed.data.daily_token_quota }
        : {}),
    })
    .select('id, label, key_prefix, plan, scopes, rate_limit_per_min, daily_token_quota, created_at, expires_at')
    .single();

  if (error || !data) {
    return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'Failed to create key', 500));
  }
  return c.json({ ...data, key: raw, warning: 'This is the only time the full key is shown.' }, 201);
});

keysRouter.delete('/:id', async (c) => {
  const user = getUser(c);
  const id = c.req.param('id');
  if (!uuid.safeParse(id).success) {
    return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Key not found', 404));
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('api_keys')
    .update({ revoked: true })
    .eq('id', id)
    .eq('user_id', user.userId)
    .select('id');

  if (error) {
    return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'Failed to revoke key', 500));
  }
  if (!data || data.length === 0) {
    return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Key not found', 404));
  }
  return c.body(null, 204);
});
