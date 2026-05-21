// Sanity-check Supabase connectivity using the service-role key.
// Run with: node --env-file=../.env.local scripts/check-supabase.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('URL:', url);
console.log('anon key set:', anonKey ? 'yes' : 'NO');
console.log('service key set:', serviceKey ? 'yes' : 'NO');

if (!url || !serviceKey) {
  console.error('Missing env vars.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

// Hit auth.users via admin API — works on any project.
console.log('\nPinging auth admin API...');
const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
if (error) {
  console.error('FAIL:', error.message);
  process.exit(1);
}
console.log('OK — auth.users reachable. Existing user count (first page):', data.users.length);

// Try to read public schema tables — will fail if schema not yet applied.
console.log('\nProbing public.profiles (expect "relation does not exist" if schema not applied)...');
const { data: rows, error: tableErr } = await admin
  .from('profiles')
  .select('id', { count: 'exact', head: true })
  .limit(1);
if (tableErr) {
  console.log('SCHEMA STATUS: not applied yet —', tableErr.message);
} else {
  console.log('SCHEMA STATUS: applied. profiles row count:', rows);
}
