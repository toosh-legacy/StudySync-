import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.js';

let adminClient: ReturnType<typeof createClient<Database>> | undefined;
let anonClient: ReturnType<typeof createClient<Database>> | undefined;

export function createAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('SUPABASE_URL is not set');
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  if (serviceKey.startsWith('eyJ') === false && serviceKey.length < 40) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY looks malformed');
  }

  if (adminClient) return adminClient;
  adminClient = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

function getAnonClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) throw new Error('SUPABASE_URL is not set');
  if (!anonKey) throw new Error('SUPABASE_ANON_KEY is not set');

  if (anonClient) return anonClient;
  anonClient = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return anonClient;
}

export async function verifyJwt(
  token: string,
): Promise<{ userId: string } | null> {
  const supabase = getAnonClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id };
}
