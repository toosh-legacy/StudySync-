import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { createAdminClient } from '../lib/supabase.js';
import { apiError, ErrorCode } from '../lib/errors.js';
import { getUser, parseJson, sendError } from '../lib/http.js';
import { preferencesUpdateSchema } from '../types/api.js';

export const preferencesRouter = new Hono();
preferencesRouter.use('*', requireAuth);

preferencesRouter.get('/', async (c) => {
  const user = getUser(c);
  const admin = createAdminClient();
  const { data } = await admin
    .from('user_preferences')
    .select('default_format, default_depth, auto_scan_page, cache_outputs, spaced_repetition')
    .eq('user_id', user.userId)
    .maybeSingle();
  return c.json(data ?? {});
});

preferencesRouter.patch('/', async (c) => {
  const user = getUser(c);
  const parsed = await parseJson(c, preferencesUpdateSchema);
  if ('error' in parsed) return sendError(c, parsed.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('user_preferences')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('user_id', user.userId)
    .select('default_format, default_depth, auto_scan_page, cache_outputs, spaced_repetition')
    .single();

  if (error || !data) {
    return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'Failed to update preferences', 500));
  }
  return c.json(data);
});
