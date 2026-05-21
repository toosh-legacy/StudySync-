import 'server-only';

import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';
import { apiFetch, ApiError, type RequestOptions } from '@/lib/api-fetch';
import { buildApi, type Api } from '@/lib/api-shape';

async function getServerAccessToken(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function call<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = opts.unauthenticated ? null : await getServerAccessToken();
  return apiFetch<T>(path, { ...opts, token });
}

export const api: Api = buildApi(call);
export { ApiError };
export type {
  Course,
  ConnectionStatus,
  Profile,
  VaultListItem,
  DashboardStats,
  SharePayload,
  PreferencesPayload,
  ApiKeyRow,
  ApiKeyCreated,
} from '@/lib/api-shape';
