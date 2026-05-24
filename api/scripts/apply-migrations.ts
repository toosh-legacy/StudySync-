/**
 * Applies SQL migrations in webapp/supabase/migrations to the linked Supabase
 * project via the Management API.
 *
 *   npm run db:migrate
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL (for the project ref) and SUPABASE_ACCESS_TOKEN
 * from the repo-root .env.local. Migrations are written to be idempotent, so this
 * is safe to re-run.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const here = fileURLToPath(new URL('.', import.meta.url)); // api/scripts/
config({ path: resolve(here, '../../.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!url || !token) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_ACCESS_TOKEN in .env.local');
  process.exit(1);
}

const ref = new URL(url).hostname.split('.')[0];
const migrationsDir = resolve(here, '../../webapp/supabase/migrations');
const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

if (files.length === 0) {
  console.log('No migrations found.');
  process.exit(0);
}

for (const file of files) {
  const query = readFileSync(resolve(migrationsDir, file), 'utf8');
  process.stdout.write(`Applying ${file} ... `);
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    console.log('FAILED');
    console.error(`  ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  console.log('ok');
}

console.log('All migrations applied.');
