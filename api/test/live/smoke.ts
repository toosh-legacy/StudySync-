/**
 * Live end-to-end smoke test against real Supabase + OpenAI.
 *
 *   npm run smoke
 *
 * Loads credentials from StudySync-/.env.local, provisions a throwaway user +
 * course + API key, drives the real app in-process through every major route
 * (one real OpenAI generation), prints a PASS/FAIL table, then deletes everything
 * it created. Costs a few cents of OpenAI usage.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const here = fileURLToPath(new URL('.', import.meta.url));
// api/test/live -> StudySync-/.env.local
config({ path: resolve(here, '../../../.env.local') });
config({ path: resolve(here, '../../.env') }); // optional api/.env fallback

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !process.env.OPENAI_API_KEY) {
  console.error(
    'Missing required env. Need SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY in .env.local',
  );
  process.exit(1);
}

// Import the app only after env is loaded.
const { createApp } = await import('../../src/app.js');
const app = createApp();

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface Result {
  name: string;
  status: 'PASS' | 'FAIL';
  detail: string;
}
const results: Result[] = [];

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, status: 'PASS', detail: '' });
    console.log(`PASS  ${name}`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ name, status: 'FAIL', detail });
    console.log(`FAIL  ${name} — ${detail}`);
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const email = `smoke+${Date.now()}@studysync.test`;
let userId = '';
let courseId = '';
let rawKey = '';
let generatedId = '';

async function setup() {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: randomBytes(16).toString('hex'),
    email_confirm: true,
  });
  if (error || !created.user) throw new Error(`createUser failed: ${error?.message}`);
  userId = created.user.id;

  // Profiles row may be auto-created by a trigger; upsert to ensure plan.
  await admin
    .from('profiles')
    .upsert({ id: userId, display_name: 'Smoke Tester', plan: 'developer' }, { onConflict: 'id' });

  const { data: course, error: cErr } = await admin
    .from('courses')
    .insert({ user_id: userId, name: 'Smoke Test Course', color: '#1D9E75' })
    .select('id')
    .single();
  if (cErr || !course) throw new Error(`course insert failed: ${cErr?.message}`);
  courseId = course.id;

  rawKey = `ss_live_${randomBytes(32).toString('hex')}`;
  const { error: kErr } = await admin.from('api_keys').insert({
    id: randomUUID(),
    user_id: userId,
    label: 'smoke',
    key_hash: createHash('sha256').update(rawKey).digest('hex'),
    key_prefix: rawKey.slice(0, 16),
    plan: 'developer',
    revoked: false,
  });
  if (kErr) throw new Error(`api_key insert failed: ${kErr.message}`);
}

function authed(extra: Record<string, string> = {}): RequestInit {
  return { headers: { 'X-API-Key': rawKey, ...extra } };
}
function jsonReq(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'X-API-Key': rawKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

async function run() {
  await check('GET /v1/healthz', async () => {
    const res = await app.request('/v1/healthz');
    assert(res.status === 200, `status ${res.status}`);
  });

  await check('GET /v1/meta/formats (public)', async () => {
    const res = await app.request('/v1/meta/formats');
    assert(res.status === 200, `status ${res.status}`);
    const b = await (res.json() as Promise<any>);
    assert(b.output_formats.length === 6, 'expected 6 formats');
  });

  await check('GET /v1/openapi.json (public)', async () => {
    const res = await app.request('/v1/openapi.json');
    assert(res.status === 200, `status ${res.status}`);
    assert((await (res.json() as Promise<any>)).openapi === '3.1.0', 'bad openapi version');
  });

  await check('GET /v1/profile (api key auth)', async () => {
    const res = await app.request('/v1/profile', authed());
    assert(res.status === 200, `status ${res.status}`);
  });

  await check('GET /v1/courses', async () => {
    const res = await app.request('/v1/courses', authed());
    assert(res.status === 200, `status ${res.status}`);
    const list = await (res.json() as Promise<any>);
    assert(Array.isArray(list) && list.length >= 1, 'expected at least one course');
  });

  await check('GET /v1/courses/:id', async () => {
    const res = await app.request(`/v1/courses/${courseId}`, authed());
    assert(res.status === 200, `status ${res.status}`);
  });

  await check('PATCH /v1/courses/:id', async () => {
    const res = await app.request(`/v1/courses/${courseId}`, jsonReq('PATCH', { code: 'SMK101' }));
    assert(res.status === 200, `status ${res.status}`);
  });

  await check('GET /v1/preferences', async () => {
    const res = await app.request('/v1/preferences', authed());
    assert(res.status === 200, `status ${res.status}`);
  });

  await check('GET /v1/keys', async () => {
    const res = await app.request('/v1/keys', authed());
    assert(res.status === 200, `status ${res.status}`);
  });

  await check('POST /v1/generate (real OpenAI)', async () => {
    const res = await app.request(
      '/v1/generate',
      jsonReq('POST', {
        course_id: courseId,
        output_format: 'summary',
        depth: 'quick',
        comprehension: 'beginner',
        sources: [
          {
            provider: 'manual',
            source_name: `Smoke note ${Date.now()}`,
            content:
              'Mitochondria are the powerhouse of the cell. They produce ATP via oxidative phosphorylation across the inner membrane.',
          },
        ],
      }),
    );
    const body = await (res.json() as Promise<any>);
    assert(res.status === 200, `status ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
    assert(body.output && typeof body.output === 'object', 'no output object');
    assert(body.usage.total_tokens > 0, 'no token usage reported');
    assert(body.comprehension === 'beginner', 'comprehension not echoed/persisted');
    generatedId = body.request_id;
  });

  await check('GET /v1/vault', async () => {
    const res = await app.request('/v1/vault', authed());
    assert(res.status === 200, `status ${res.status}`);
    assert((await (res.json() as Promise<any>)).items.length >= 1, 'expected vault item');
  });

  await check('GET /v1/vault/:id', async () => {
    assert(generatedId, 'no generated id (generation failed)');
    const res = await app.request(`/v1/vault/${generatedId}`, authed());
    assert(res.status === 200, `status ${res.status}`);
  });

  await check('PATCH /v1/vault/:id/share + public GET /v1/shares/:id', async () => {
    assert(generatedId, 'no generated id (generation failed)');
    const share = await app.request(`/v1/vault/${generatedId}/share`, jsonReq('PATCH', { public_share: true }));
    assert(share.status === 200, `share status ${share.status}`);
    const pub = await app.request(`/v1/shares/${generatedId}`); // no auth
    assert(pub.status === 200, `public share status ${pub.status}`);
  });

  await check('GET /v1/dashboard/stats', async () => {
    const res = await app.request('/v1/dashboard/stats', authed());
    assert(res.status === 200, `status ${res.status}`);
    const b = await (res.json() as Promise<any>);
    assert(b.generations_this_month >= 1, 'expected >=1 generation this month');
  });

  await check('GET /v1/usage', async () => {
    const res = await app.request('/v1/usage', authed());
    assert(res.status === 200, `status ${res.status}`);
    const b = await (res.json() as Promise<any>);
    assert(b.totals.generations >= 1, 'expected usage to record the generation');
  });

  await check('GET /v1/healthz/ready (deep)', async () => {
    const res = await app.request('/v1/healthz/ready');
    assert(res.status === 200, `status ${res.status}`);
    const b = await (res.json() as Promise<any>);
    assert(b.checks.database === true, 'database check failed');
  });

  await check('GET /v1/meta/docs (Swagger UI)', async () => {
    const res = await app.request('/v1/meta/docs');
    assert(res.status === 200, `status ${res.status}`);
  });

  await check('Idempotency-Key replays the same response', async () => {
    const body = {
      course_id: courseId,
      output_format: 'summary',
      depth: 'quick',
      sources: [{ provider: 'manual', source_name: 'Idem note', content: 'Cells have membranes.' }],
    };
    const init = (): RequestInit => ({
      method: 'POST',
      headers: { 'X-API-Key': rawKey, 'Content-Type': 'application/json', 'Idempotency-Key': 'smoke-idem-1' },
      body: JSON.stringify(body),
    });
    const r1 = await app.request('/v1/generate', init());
    const b1 = await (r1.json() as Promise<any>);
    const r2 = await app.request('/v1/generate', init());
    const b2 = await (r2.json() as Promise<any>);
    assert(r1.status === 200 && r2.status === 200, `status ${r1.status}/${r2.status}`);
    assert(b1.request_id === b2.request_id, 'idempotent replay returned a different request_id');
  });

  await check('async job: submit + poll to completion', async () => {
    const res = await app.request('/v1/generate/jobs', {
      method: 'POST',
      headers: { 'X-API-Key': rawKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_id: courseId,
        output_format: 'flashcards',
        depth: 'quick',
        sources: [{ provider: 'manual', source_name: 'Job note', content: 'Osmosis moves water across membranes.' }],
      }),
    });
    assert(res.status === 202, `submit status ${res.status}`);
    const { job_id } = await (res.json() as Promise<any>);
    let final: any = null;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const poll = await app.request(`/v1/generate/jobs/${job_id}`, authed());
      const b = await (poll.json() as Promise<any>);
      if (b.status === 'completed' || b.status === 'failed') {
        final = b;
        break;
      }
    }
    assert(final, 'job did not finish');
    assert(final.status === 'completed', `job status ${final?.status}: ${JSON.stringify(final?.error)}`);
  });
}

async function teardown() {
  if (!userId) return;
  await admin.from('generated_outputs').delete().eq('user_id', userId);
  await admin.from('idempotency_keys').delete().eq('user_id', userId);
  await admin.from('generation_jobs').delete().eq('user_id', userId);
  await admin.from('source_cache').delete().eq('user_id', userId);
  await admin.from('source_connections').delete().eq('user_id', userId);
  await admin.from('token_usage').delete().eq('user_id', userId);
  await admin.from('user_preferences').delete().eq('user_id', userId);
  await admin.from('api_keys').delete().eq('user_id', userId);
  await admin.from('courses').delete().eq('user_id', userId);
  await admin.auth.admin.deleteUser(userId).catch(() => undefined);
}

try {
  await setup();
  await run();
} catch (err) {
  console.error('Smoke setup error:', err);
  results.push({ name: 'setup', status: 'FAIL', detail: String(err) });
} finally {
  await teardown();
}

const failed = results.filter((r) => r.status === 'FAIL');
console.log('\n──────── SMOKE SUMMARY ────────');
console.log(`${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
}
process.exit(failed.length ? 1 : 0);
