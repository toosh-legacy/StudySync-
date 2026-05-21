// Framework-agnostic fetch helper for the StudySync API.
// Has zero Next.js or Supabase imports so it can be safely bundled into
// either Server Components or Client Components without dragging in
// `next/headers`.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  status: number;
  code?: string;
  body?: unknown;
  constructor(status: number, message: string, code?: string, body?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  unauthenticated?: boolean;
  cache?: RequestCache;
  next?: { revalidate?: number; tags?: string[] };
  signal?: AbortSignal;
}

export async function apiFetch<T>(
  path: string,
  opts: RequestOptions & { token?: string | null } = {},
): Promise<T> {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, API_BASE);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!opts.unauthenticated && opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }

  const init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: opts.cache,
    signal: opts.signal,
  };
  if (opts.next) init.next = opts.next;

  const res = await fetch(url.toString(), init);
  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      (typeof payload === 'object' &&
        payload !== null &&
        'message' in payload &&
        typeof (payload as { message?: unknown }).message === 'string'
        ? (payload as { message: string }).message
        : null) ?? `Request failed with ${res.status}`;
    const code =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : undefined;
    throw new ApiError(res.status, message, code, payload);
  }

  return payload as T;
}
