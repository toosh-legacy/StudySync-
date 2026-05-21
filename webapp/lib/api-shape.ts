// Typed `api` surface used by both browser and server flavors of the
// StudySync API client. Pure types + a builder; no token-fetching logic.

import type { RequestOptions } from '@/lib/api-fetch';

export interface Course {
  id: string;
  code: string | null;
  name: string;
  color: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConnectionStatus {
  provider: 'google_drive' | 'notion' | 'canvas' | 'moodle' | 'obsidian';
  connected: boolean;
  display_name: string | null;
  detail_label: string | null;
  last_synced_at: string | null;
}

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  plan: 'free' | 'student' | 'team' | 'enterprise';
  created_at: string;
  updated_at: string;
}

export interface VaultListItem {
  id: string;
  course_id: string | null;
  output_format: string;
  depth: string;
  sources_used_count: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cache_hit: boolean;
  created_at: string;
  preview: string;
}

export interface DashboardStats {
  generations_this_month: number;
  courses: number;
  connected_sources: number;
  tokens_used_today: number;
}

export interface SharePayload {
  id: string;
  output_format: string;
  depth: string;
  output: Record<string, unknown>;
  sources_used_count: number;
  created_at: string;
  course: { name: string; code: string | null } | null;
}

export interface PreferencesPayload {
  default_format?: string;
  default_depth?: string;
  auto_scan_page?: boolean;
  cache_outputs?: boolean;
  spaced_repetition?: boolean;
}

export interface ApiKeyRow {
  id: string;
  label: string;
  key_prefix: string;
  plan: string;
  usage_count: number;
  last_used_at: string | null;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
}

export interface ApiKeyCreated extends ApiKeyRow {
  key: string;
  warning: string;
}

export type CallFn = <T>(path: string, opts?: RequestOptions) => Promise<T>;

export interface Api {
  getProfile(): Promise<Profile>;
  getStats(): Promise<DashboardStats>;
  listCourses(): Promise<Course[]>;
  createCourse(body: { name: string; code?: string; color?: string }): Promise<Course>;
  updateCourse(
    id: string,
    body: { name?: string; code?: string | null; color?: string; archived?: boolean },
  ): Promise<Course>;
  deleteCourse(id: string): Promise<void>;
  listConnections(): Promise<ConnectionStatus[]>;
  connectOAuth(provider: 'google_drive' | 'notion'): Promise<{ redirect_url: string }>;
  connectCanvas(body: { canvas_url: string; api_token: string }): Promise<{ ok: true }>;
  connectMoodle(body: { moodle_url: string; web_service_token: string }): Promise<{ ok: true }>;
  connectObsidian(body: { content: string }): Promise<{ ok: true }>;
  disconnectProvider(
    provider: 'google_drive' | 'notion' | 'canvas' | 'moodle' | 'obsidian',
  ): Promise<void>;
  listVault(filters?: {
    course_id?: string;
    output_format?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: VaultListItem[]; limit: number; offset: number }>;
  getVaultItem(id: string): Promise<Record<string, unknown>>;
  deleteVaultItem(id: string): Promise<void>;
  setVaultShare(
    id: string,
    publicShare: boolean,
  ): Promise<{ public_share: boolean; share_url: string | null }>;
  listKeys(): Promise<ApiKeyRow[]>;
  createKey(label: string, expiresAt?: string): Promise<ApiKeyCreated>;
  revokeKey(id: string): Promise<void>;
  getPreferences(): Promise<PreferencesPayload>;
  updatePreferences(patch: PreferencesPayload): Promise<PreferencesPayload>;
  getShare(id: string): Promise<SharePayload>;
  collectSources(body: {
    course_id: string;
    providers: string[];
    current_page_content?: string;
    current_page_url?: string;
    current_page_title?: string;
  }): Promise<unknown>;
  generate(body: unknown): Promise<unknown>;
}

export function buildApi(call: CallFn): Api {
  return {
    getProfile: () => call<Profile>('/v1/profile'),
    getStats: () => call<DashboardStats>('/v1/dashboard/stats'),

    listCourses: () => call<Course[]>('/v1/courses'),
    createCourse: (body) => call<Course>('/v1/courses', { method: 'POST', body }),
    updateCourse: (id, body) =>
      call<Course>(`/v1/courses/${id}`, { method: 'PATCH', body }),
    deleteCourse: (id) => call<void>(`/v1/courses/${id}`, { method: 'DELETE' }),

    listConnections: () => call<ConnectionStatus[]>('/v1/connections'),
    connectOAuth: (provider) =>
      call<{ redirect_url: string }>(`/v1/connections/${provider}`, {
        method: 'POST',
        body: {},
      }),
    connectCanvas: (body) =>
      call<{ ok: true }>('/v1/connections/canvas', { method: 'POST', body }),
    connectMoodle: (body) =>
      call<{ ok: true }>('/v1/connections/moodle', { method: 'POST', body }),
    connectObsidian: (body) =>
      call<{ ok: true }>('/v1/connections/obsidian', { method: 'POST', body }),
    disconnectProvider: (provider) =>
      call<void>(`/v1/connections/${provider}/disconnect`, { method: 'DELETE' }),

    listVault: (filters = {}) =>
      call('/v1/vault', { query: filters }),
    getVaultItem: (id) => call<Record<string, unknown>>(`/v1/vault/${id}`),
    deleteVaultItem: (id) => call<void>(`/v1/vault/${id}`, { method: 'DELETE' }),
    setVaultShare: (id, publicShare) =>
      call(`/v1/vault/${id}/share`, {
        method: 'PATCH',
        body: { public_share: publicShare },
      }),

    listKeys: () => call<ApiKeyRow[]>('/v1/keys'),
    createKey: (label, expiresAt) =>
      call<ApiKeyCreated>('/v1/keys', {
        method: 'POST',
        body: { label, ...(expiresAt ? { expires_at: expiresAt } : {}) },
      }),
    revokeKey: (id) => call<void>(`/v1/keys/${id}`, { method: 'DELETE' }),

    getPreferences: () => call<PreferencesPayload>('/v1/preferences'),
    updatePreferences: (patch) =>
      call<PreferencesPayload>('/v1/preferences', { method: 'PATCH', body: patch }),

    getShare: (id) =>
      call<SharePayload>(`/v1/shares/${id}`, { unauthenticated: true }),

    collectSources: (body) =>
      call('/v1/sources/collect', { method: 'POST', body }),
    generate: (body) => call('/v1/generate', { method: 'POST', body }),
  };
}
