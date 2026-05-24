/**
 * Eyeball prompt quality across formats against the real model.
 *   npx tsx test/live/verify-prompts.ts
 * Provisions a throwaway user/course/key, generates several formats from one
 * source, prints the outputs, and cleans up.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const here = fileURLToPath(new URL('.', import.meta.url));
config({ path: resolve(here, '../../../.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const { createApp } = await import('../../src/app.js');
const app = createApp();
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SOURCE = `Photosynthesis is the process by which green plants, algae, and some bacteria convert light energy into chemical energy stored in glucose. It occurs in two stages. The light-dependent reactions take place in the thylakoid membranes of the chloroplast: chlorophyll absorbs photons, water is split (photolysis) releasing oxygen, and ATP and NADPH are produced. The light-independent reactions (the Calvin cycle) occur in the stroma: carbon dioxide is fixed by the enzyme RuBisCO and, using ATP and NADPH, is reduced to form glucose. The overall equation is 6CO2 + 6H2O + light -> C6H12O6 + 6O2. Factors affecting the rate include light intensity, CO2 concentration, and temperature.`;

let userId = '';
let courseId = '';
let rawKey = '';

async function setup() {
  const { data } = await admin.auth.admin.createUser({
    email: `verify+${Date.now()}@studysync.test`,
    password: randomBytes(16).toString('hex'),
    email_confirm: true,
  });
  userId = data!.user!.id;
  await admin.from('profiles').upsert({ id: userId, plan: 'developer' }, { onConflict: 'id' });
  const { data: course } = await admin
    .from('courses')
    .insert({ user_id: userId, name: 'Biology 101' })
    .select('id')
    .single();
  courseId = course!.id;
  rawKey = `ss_live_${randomBytes(32).toString('hex')}`;
  await admin.from('api_keys').insert({
    user_id: userId,
    label: 'verify',
    key_hash: createHash('sha256').update(rawKey).digest('hex'),
    key_prefix: rawKey.slice(0, 16),
    plan: 'developer',
    revoked: false,
  });
}

async function gen(output_format: string, depth: string, comprehension: string) {
  const res = await app.request('/v1/generate', {
    method: 'POST',
    headers: { 'X-API-Key': rawKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      course_id: courseId,
      output_format,
      depth,
      comprehension,
      sources: [{ provider: 'manual', source_name: 'Bio chapter', content: SOURCE }],
    }),
  });
  const body = (await res.json()) as any;
  console.log(`\n=========== ${output_format} (${depth}/${comprehension}) — ${res.status} ===========`);
  console.log(JSON.stringify(body.output, null, 2));
  console.log(`tokens: ${body.usage?.total_tokens}  cost: $${body.usage?.estimated_cost_usd}`);
}

async function teardown() {
  if (!userId) return;
  await admin.from('generated_outputs').delete().eq('user_id', userId);
  await admin.from('api_keys').delete().eq('user_id', userId);
  await admin.from('courses').delete().eq('user_id', userId);
  await admin.auth.admin.deleteUser(userId).catch(() => undefined);
}

try {
  await setup();
  await gen('flashcards', 'quick', 'beginner');
  await gen('practice_questions', 'standard', 'intermediate');
  await gen('notes', 'standard', 'advanced');
} catch (e) {
  console.error(e);
} finally {
  await teardown();
}
process.exit(0);
