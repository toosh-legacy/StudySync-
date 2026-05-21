// Browser-side API client. Reads the access token from the Supabase
// browser session and attaches it to every request. For Server Components
// / Route Handlers, use `@/lib/api-client.server` instead — it reads the
// token from the cookie-backed session.

import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client';
import { apiFetch, ApiError, type RequestOptions } from '@/lib/api-fetch';
import { buildApi, type Api } from '@/lib/api-shape';

async function getBrowserAccessToken(): Promise<string | null> {
  const supabase = createBrowserSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function call<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = opts.unauthenticated ? null : await getBrowserAccessToken();
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
