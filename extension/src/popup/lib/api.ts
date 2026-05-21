import {
  getApiBase,
  getSessionToken,
  type ConnectionStatus,
  type Course,
} from './storage';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const base = await getApiBase();
  const token = await getSessionToken();
  const headers = new Headers(init.headers ?? {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (!res.ok) {
    let body: { error?: string; message?: string } = {};
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(
      body.message ?? `HTTP ${res.status}`,
      res.status,
      body.error ?? 'UNKNOWN',
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const getCourses = () => apiFetch<Course[]>('/v1/courses');

export const createCourse = (input: {
  name: string;
  code?: string;
  color?: string;
}) =>
  apiFetch<Course>('/v1/courses', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const getConnections = () =>
  apiFetch<ConnectionStatus[]>('/v1/connections');

export interface CollectedSource {
  provider: string;
  source_name: string;
  source_url?: string | null;
  content: string;
  characters: number;
}

export interface CollectResponse {
  collected: CollectedSource[];
  skipped: { provider: string; reason: string }[];
  total_characters: number;
  warning?: string;
}

export const collectSources = (body: {
  course_id: string;
  providers: ConnectionStatus['provider'][];
  current_page_content?: string;
  current_page_url?: string;
  current_page_title?: string;
}) =>
  apiFetch<CollectResponse>('/v1/sources/collect', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export interface GenerateResponse {
  request_id: string;
  cache_hit: boolean;
  output_format: string;
  depth: string;
  output: Record<string, unknown>;
  sources_used_count: number;
}

export const generate = (body: {
  course_id: string;
  output_format: string;
  depth: string;
  sources: CollectedSource[];
}) =>
  apiFetch<GenerateResponse>('/v1/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
