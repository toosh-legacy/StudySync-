import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { createAdminClient } from '../lib/supabase.js';
import { getUser } from '../lib/http.js';

export const dashboardRouter = new Hono();
dashboardRouter.use('*', requireAuth);

function startOfMonthIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

dashboardRouter.get('/stats', async (c) => {
  const user = getUser(c);
  const admin = createAdminClient();

  const [
    { count: genCount },
    { count: courseCount },
    { count: connectionsCount },
    { data: tokenRow },
  ] = await Promise.all([
    admin
      .from('generated_outputs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.userId)
      .gte('created_at', startOfMonthIso()),
    admin
      .from('courses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.userId)
      .eq('archived', false),
    admin
      .from('source_connections')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.userId)
      .eq('connected', true),
    admin
      .from('token_usage')
      .select('tokens_used')
      .eq('user_id', user.userId)
      .eq('date', todayIso())
      .maybeSingle(),
  ]);

  return c.json({
    generations_this_month: genCount ?? 0,
    courses: courseCount ?? 0,
    connected_sources: connectionsCount ?? 0,
    tokens_used_today: tokenRow?.tokens_used ?? 0,
  });
});
