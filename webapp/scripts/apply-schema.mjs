// Apply the full schema.sql via Supabase Management API.
// Run with: node --env-file=.env.local scripts/apply-schema.mjs
import { readFileSync } from 'fs';

const PROJECT_REF = 'atghzuklyeaajnpjrbhm';
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN not set');
  process.exit(1);
}

const sql = readFileSync('supabase/schema.sql', 'utf8');
console.log(`Applying schema (${sql.length} chars)...`);

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  },
);

const text = await res.text();
console.log('status:', res.status);
console.log('body:', text.slice(0, 2000));
if (!res.ok) process.exit(1);
