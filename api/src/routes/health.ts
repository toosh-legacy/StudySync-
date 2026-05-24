import { Hono } from 'hono';
import { createAdminClient } from '../lib/supabase.js';

export const healthRouter = new Hono();

// Liveness: cheap, no dependencies. Use for load-balancer health checks.
healthRouter.get('/', (c) =>
  c.json({ ok: true, service: 'studysync-api', version: '0.1.0' }),
);

// Readiness: verifies downstream dependencies are reachable/configured. Returns
// 503 if a hard dependency (the database) is unavailable.
healthRouter.get('/ready', async (c) => {
  const checks: Record<string, boolean> = {
    database: false,
    openai: Boolean(process.env.OPENAI_API_KEY),
  };

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .limit(1);
    checks.database = !error;
  } catch {
    checks.database = false;
  }

  const ok = checks.database;
  return c.json({ ok, checks }, ok ? 200 : 503);
});
