// Run with: node --env-file=../.env.local scripts/apply-share-migration.mjs

const PROJECT_REF = 'atghzuklyeaajnpjrbhm';
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN not set');
  process.exit(1);
}

const sql = `
ALTER TABLE public.generated_outputs
  ADD COLUMN IF NOT EXISTS public_share BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_outputs_public_share
  ON public.generated_outputs(public_share)
  WHERE public_share = TRUE;
DROP POLICY IF EXISTS "outputs_public_read" ON public.generated_outputs;
CREATE POLICY "outputs_public_read" ON public.generated_outputs FOR SELECT
  USING (public_share = TRUE);
`;

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
console.log('body:', text);
if (!res.ok) process.exit(1);
