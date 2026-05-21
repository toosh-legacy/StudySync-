import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { createAdminClient } from '../lib/supabase.js';
import { apiError, ErrorCode } from '../lib/errors.js';
import { getUser, sendError } from '../lib/http.js';

export const profileRouter = new Hono();

profileRouter.use('*', requireAuth);

profileRouter.get('/', async (c) => {
  const user = getUser(c);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .select('id, display_name, avatar_url, plan, created_at, updated_at')
    .eq('id', user.userId)
    .maybeSingle();

  if (error) {
    return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'Failed to load profile', 500));
  }
  if (!data) {
    return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Profile not found', 404));
  }
  return c.json(data);
});
