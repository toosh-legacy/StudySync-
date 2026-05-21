export interface Course {
  id: string;
  code: string | null;
  name: string;
  color: string;
}

export interface ConnectionStatus {
  provider: 'google_drive' | 'notion' | 'canvas' | 'moodle' | 'obsidian';
  connected: boolean;
  display_name: string | null;
  detail_label: string | null;
}

interface StorageShape {
  api_base?: string;
  app_base?: string;
  session_token?: string;
  courses_cache?: Course[];
  courses_cached_at?: number;
  connections_cache?: ConnectionStatus[];
  connections_cached_at?: number;
  preferences?: {
    auto_scan_page: boolean;
    cache_outputs: boolean;
    spaced_repetition: boolean;
  };
}

const DEFAULT_API_BASE = 'http://localhost:3001';
const DEFAULT_APP_BASE = 'http://localhost:3000';

export async function getStorage<K extends keyof StorageShape>(
  key: K,
): Promise<StorageShape[K]> {
  const result = await chrome.storage.local.get(key);
  return result[key];
}

export async function setStorage(patch: Partial<StorageShape>): Promise<void> {
  await chrome.storage.local.set(patch);
}

export async function getApiBase(): Promise<string> {
  return (await getStorage('api_base')) ?? DEFAULT_API_BASE;
}

export async function getAppBase(): Promise<string> {
  return (await getStorage('app_base')) ?? DEFAULT_APP_BASE;
}

export async function getSessionToken(): Promise<string | undefined> {
  return await getStorage('session_token');
}

export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove([
    'session_token',
    'courses_cache',
    'courses_cached_at',
    'connections_cache',
    'connections_cached_at',
  ]);
}
