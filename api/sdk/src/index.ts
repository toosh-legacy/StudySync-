/**
 * @studysync/sdk — typed client for the StudySync API.
 *
 * Mirrors the OpenAPI document served at /v1/openapi.json (run `npm run sdk:generate`
 * in the api package to refresh sdk/openapi.json + sdk/src/schema.d.ts for raw spec
 * types). This hand-written client adds typed responses and conveniences.
 */

// ---------- Shared types ----------

export type OutputFormat =
  | 'flashcards'
  | 'study_guide'
  | 'notes'
  | 'practice_questions'
  | 'summary'
  | 'mind_map';
export type Depth = 'quick' | 'standard' | 'deep';
export type Comprehension = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type Scope = 'generate:read' | 'generate:write';

export interface GenerateSource {
  provider: string;
  source_name: string;
  source_url?: string | null;
  content: string;
}

export interface GenerateRequest {
  course_id: string;
  output_format: OutputFormat;
  depth?: Depth;
  comprehension?: Comprehension;
  model?: string;
  sources: GenerateSource[];
  user_prompt?: string;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  model: string;
}

export interface SourceRead {
  provider: string;
  source_name: string;
  source_url: string | null;
  characters_read: number;
  status: 'success';
  relevance_note: string;
}

export interface GenerateResponse {
  request_id: string;
  cache_hit: boolean;
  course_id: string;
  output_format: OutputFormat;
  depth: Depth;
  comprehension: Comprehension;
  output: Record<string, unknown>;
  sources_read: SourceRead[];
  sources_used_count: number;
  retrieval?: {
    applied: boolean;
    chunks_total: number;
    chunks_selected: number;
    chars_before: number;
    chars_after: number;
  };
  usage: Usage;
  generated_at: string;
}

export interface JobRef {
  job_id: string;
  status: 'queued';
}

export interface Job {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  result: GenerateResponse | null;
  error: Record<string, unknown> | null;
  callback_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  code: string | null;
  name: string;
  color: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface UsageReport {
  range_days: number;
  daily: Array<{
    date: string;
    generations: number;
    cache_hits: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    estimated_cost_usd: number;
  }>;
  totals: {
    generations: number;
    cache_hits: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    estimated_cost_usd: number;
  };
}

export interface StreamHandlers {
  onMeta?: (data: Record<string, unknown>) => void;
  onDelta?: (text: string) => void;
  onDone?: (data: GenerateResponse) => void;
  onError?: (data: Record<string, unknown>) => void;
}

export class StudySyncError extends Error {
  status: number;
  code: string;
  body: unknown;
  constructor(status: number, code: string, message: string, body: unknown) {
    super(message);
    this.name = 'StudySyncError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export interface StudySyncClientOptions {
  baseUrl?: string;
  /** API key (X-API-Key). Use this OR `token`. */
  apiKey?: string;
  /** Supabase JWT (Authorization: Bearer). */
  token?: string;
  /** Custom fetch (defaults to global fetch). */
  fetch?: typeof fetch;
}

export class StudySyncClient {
  private baseUrl: string;
  private apiKey?: string;
  private token?: string;
  private fetchImpl: typeof fetch;

  constructor(opts: StudySyncClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? 'http://localhost:3001').replace(/\/+$/, '');
    this.apiKey = opts.apiKey;
    this.token = opts.token;
    const f = opts.fetch ?? globalThis.fetch;
    if (!f) throw new Error('No fetch implementation available; pass options.fetch');
    this.fetchImpl = f;
  }

  private authHeaders(): Record<string, string> {
    if (this.apiKey) return { 'X-API-Key': this.apiKey };
    if (this.token) return { Authorization: `Bearer ${this.token}` };
    return {};
  }

  private async request<T>(
    method: string,
    path: string,
    opts: { body?: unknown; headers?: Record<string, string> } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { ...this.authHeaders(), ...opts.headers };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    const json = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      const code = (json && json.error) || 'ERROR';
      const message = (json && json.message) || `Request failed (${res.status})`;
      throw new StudySyncError(res.status, code, message, json);
    }
    return json as T;
  }

  // ---- Generation ----

  generate(req: GenerateRequest, opts: { idempotencyKey?: string } = {}): Promise<GenerateResponse> {
    return this.request<GenerateResponse>('POST', '/v1/generate', {
      body: req,
      headers: opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : undefined,
    });
  }

  /** Stream a generation, invoking handlers as SSE events arrive. */
  async generateStream(req: GenerateRequest, handlers: StreamHandlers): Promise<void> {
    const res = await this.fetchImpl(`${this.baseUrl}/v1/generate/stream`, {
      method: 'POST',
      headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      const json = text ? safeParse(text) : undefined;
      throw new StudySyncError(res.status, (json?.error as string) ?? 'ERROR', (json?.message as string) ?? 'Stream failed', json);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const evt of events) dispatchSse(evt, handlers);
    }
    if (buffer.trim()) dispatchSse(buffer, handlers);
  }

  createJob(req: GenerateRequest & { callback_url?: string }): Promise<JobRef> {
    return this.request<JobRef>('POST', '/v1/generate/jobs', { body: req });
  }

  getJob(id: string): Promise<Job> {
    return this.request<Job>('GET', `/v1/generate/jobs/${id}`);
  }

  /** Poll a job until it completes or fails (or times out). */
  async waitForJob(
    id: string,
    opts: { intervalMs?: number; timeoutMs?: number } = {},
  ): Promise<Job> {
    const interval = opts.intervalMs ?? 1500;
    const deadline = Date.now() + (opts.timeoutMs ?? 120_000);
    for (;;) {
      const job = await this.getJob(id);
      if (job.status === 'completed' || job.status === 'failed') return job;
      if (Date.now() > deadline) throw new Error(`Job ${id} did not finish before timeout`);
      await new Promise((r) => setTimeout(r, interval));
    }
  }

  // ---- Courses ----
  listCourses(): Promise<Course[]> {
    return this.request<Course[]>('GET', '/v1/courses');
  }
  createCourse(input: { name: string; code?: string; color?: string }): Promise<Course> {
    return this.request<Course>('POST', '/v1/courses', { body: input });
  }
  getCourse(id: string): Promise<Course> {
    return this.request<Course>('GET', `/v1/courses/${id}`);
  }
  updateCourse(id: string, patch: Partial<{ name: string; code: string | null; color: string; archived: boolean }>): Promise<Course> {
    return this.request<Course>('PATCH', `/v1/courses/${id}`, { body: patch });
  }
  deleteCourse(id: string): Promise<void> {
    return this.request<void>('DELETE', `/v1/courses/${id}`);
  }

  // ---- Usage & meta ----
  getUsage(days = 30): Promise<UsageReport> {
    return this.request<UsageReport>('GET', `/v1/usage?days=${days}`);
  }
  getFormats(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('GET', '/v1/meta/formats');
  }
  health(): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>('GET', '/v1/healthz');
  }
}

function safeParse(text: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function dispatchSse(rawEvent: string, handlers: StreamHandlers): void {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of rawEvent.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return;
  const data = safeParse(dataLines.join('\n')) ?? {};
  switch (event) {
    case 'meta':
      handlers.onMeta?.(data);
      break;
    case 'delta':
      handlers.onDelta?.(String((data as { delta?: string }).delta ?? ''));
      break;
    case 'done':
      handlers.onDone?.(data as unknown as GenerateResponse);
      break;
    case 'error':
      handlers.onError?.(data);
      break;
  }
}
