# StudySync API

Hono + Node service that turns collected course material into study artifacts
(flashcards, study guides, Cornell notes, practice questions, summaries, mind
maps) using OpenAI.

## Run

```bash
npm install
npm run dev       # http://localhost:3001
```

Configuration is read from `.env` or the repo-root `StudySync-/.env.local`
(see `.env.example`). Requires Supabase + OpenAI credentials; Upstash is optional
(rate limiting fails open without it). Startup runs `assertEnv()` and exits with a
clear message if a required variable is missing.

Production hardening built in: security headers (`secureHeaders`), 5 MB body limit,
a coarse per-IP rate limit on top of the per-user generate limit, bounded OpenAI
timeout + retries, and graceful shutdown on SIGTERM/SIGINT.

## Database migrations

```bash
npm run db:migrate   # applies webapp/supabase/migrations/*.sql via the Supabase Management API
```

Migrations are idempotent. Reads `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_ACCESS_TOKEN`
from `.env.local`. The canonical schema lives in `webapp/supabase/schema.sql`.

## Deploy

```bash
docker build -t studysync-api .
docker run -p 3001:3001 --env-file .env studysync-api
```

The multi-stage `Dockerfile` builds with `tsc`, ships only production deps + `dist`,
and runs as the non-root `node` user. Provide env vars via your platform's secrets.

## Endpoints

All routes are under `/v1`. Auth is a Supabase JWT (`Authorization: Bearer <jwt>`)
or an API key (`X-API-Key: ss_live_…`), except the public ones noted below.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/v1/healthz` | public — liveness |
| GET | `/v1/healthz/ready` | public — readiness (checks DB) |
| GET | `/v1/meta/formats` | public — self-describing capability descriptor |
| GET | `/v1/openapi.json` | public — OpenAPI 3.1 spec |
| GET | `/v1/meta/docs` | public — Swagger UI |
| GET | `/v1/profile` | |
| GET/POST | `/v1/courses` · `GET/PATCH/DELETE /v1/courses/:id` | |
| GET/PATCH | `/v1/preferences` | |
| GET/POST | `/v1/keys` · `DELETE /v1/keys/:id` | |
| GET | `/v1/vault` · `GET/DELETE /v1/vault/:id` · `PATCH /v1/vault/:id/share` | |
| GET | `/v1/shares/:id` | public (only if shared) |
| GET/POST/DELETE | `/v1/connections…` · `GET /v1/connections/:provider/callback` | callback is public |
| POST | `/v1/sources/collect` | |
| POST | `/v1/generate` | buffered JSON; honours `Idempotency-Key` |
| POST | `/v1/generate/stream` | Server-Sent Events |
| POST | `/v1/generate/jobs` | async job (202), optional `callback_url` webhook |
| GET | `/v1/generate/jobs/:id` | poll job status/result |
| GET | `/v1/dashboard/stats` | |
| GET | `/v1/usage?days=30` | daily token usage + estimated cost |

## Generate request

```jsonc
{
  "course_id": "uuid",
  "output_format": "flashcards | study_guide | notes | practice_questions | summary | mind_map",
  "depth": "quick | standard | deep",          // density — how much (default standard)
  "comprehension": "beginner | intermediate | advanced | expert", // how complex (default intermediate)
  "model": "gpt-4o-mini | gpt-4.1-mini | gpt-4o",  // optional; premium models need a paid plan
  "sources": [{ "provider": "...", "source_name": "...", "content": "...", "source_url": "..." }],
  "user_prompt": "optional free-text steer"
}
```

`GET /v1/meta/formats` returns the live list of formats, depths, comprehension
levels, models (with pricing + minimum plan), and size limits.

### Streaming

`POST /v1/generate/stream` emits SSE events:

- `meta` — `{ cache_hit, output_format, model }`
- `delta` — `{ delta }` raw model text (accumulate then `JSON.parse`)
- `done` — the persisted output + usage (same shape as the buffered response)
- `error` — an error payload if generation fails

A cache hit emits a single `done` event (no `delta`s).

## Tests

```bash
npm test            # mocked unit + route suite (no network, no cost)
npm run test:coverage
npm run smoke       # live end-to-end against real Supabase + OpenAI (costs a few cents)
```

- Mocked tests live in `test/`. Supabase, OpenAI, and Upstash are replaced with
  in-memory/controllable fakes wired up in `test/setup.ts` and
  `test/helpers/`. They cover every route's success and failure paths.
- `npm run smoke` (`test/live/smoke.ts`) provisions a throwaway user + course +
  API key, runs one real generation through every major route, prints a PASS/FAIL
  table, and deletes everything it created.
- `npx tsx test/live/verify-prompts.ts` generates several formats from one sample
  source and prints the outputs — handy for eyeballing prompt-quality changes.

`npm run typecheck` type-checks `src` **and** `test` (NodeNext). `npm run build`
emits `dist` from `src` only (`tsconfig.build.json`).

## Models

`gpt-4o-mini` is the default and the only model available on the free plan. Paid
plans may opt into `gpt-4.1-mini` / `gpt-4o` per request (`model` field), validated
against the allowlist in `src/lib/openai/models.ts` with per-model pricing.

## Production features

- **Structured Outputs** — generation uses OpenAI strict `json_schema`
  (`src/lib/openai/schemas.ts`), guaranteeing schema-valid JSON per format.
- **Embedding retrieval** — when combined source content exceeds ~60k chars, it is
  chunked, embedded (`text-embedding-3-small`, cached in `embedding_cache`), and
  reduced to the most query-relevant chunks before generation. The response
  includes a `retrieval` summary when applied.
- **Idempotency** — send `Idempotency-Key` on `POST /v1/generate`; a repeat with
  the same key replays the stored response (24h), and reuse with a different body
  returns `409`.
- **Async jobs + webhooks** — `POST /v1/generate/jobs` returns `202` with a
  `job_id`; poll `GET /v1/generate/jobs/:id`. Provide `callback_url` to receive a
  signed webhook (`X-StudySync-Signature: sha256=<hmac>`, secret =
  `WEBHOOK_SIGNING_SECRET`). **Durable dispatch:** when `QSTASH_TOKEN` is set,
  jobs are delivered via Upstash QStash (retries, survives restarts, scales across
  instances) to `/v1/internal/generation-jobs/process` (verified by the QStash
  signature); otherwise they run in-process with a read-time timeout reaper.
- **Per-key scopes & quotas** — API keys carry `scopes`
  (`generate:read`/`generate:write`), an optional `rate_limit_per_min`, and an
  optional `daily_token_quota`, all settable at key creation and enforced on
  generation. JWT sessions get all scopes.
- **Atomic budget check** — daily token budget is enforced via a row-locking RPC
  (`check_budget_and_lock`) so concurrent requests can't overshoot.
- **Retry-After** — all `429` responses include a `Retry-After` header.
- **Encryption at rest** — provider OAuth/API tokens are AES-256-GCM encrypted
  (`TOKEN_ENCRYPTION_KEY`); legacy plaintext rows are read transparently and
  upgraded on next write.
- **Observability** — every request gets an `X-Request-Id` (propagated if
  supplied) and one structured JSON log line. `GET /v1/healthz/ready` checks the
  database. (OTLP tracing is an env-gated seam in `src/lib/logging.ts`.)
- **Usage & cost** — `GET /v1/usage` returns daily tokens, cache hits, and
  estimated cost.

### Deprecating an endpoint

Call `setDeprecation(c, { sunset, link })` (`src/lib/http.ts`) in a handler to emit
RFC 8594 `Deprecation`/`Sunset`/`Link` headers.

## Client SDK

A typed client lives in [`sdk/`](./sdk) (`@studysync/sdk`). Regenerate its types
from the live spec:

```bash
npm run sdk:generate   # writes sdk/openapi.json + sdk/src/schema.d.ts
```

```ts
import { StudySyncClient } from '@studysync/sdk';
const client = new StudySyncClient({ baseUrl, apiKey });
const out = await client.generate({ course_id, output_format: 'flashcards', sources });
```

See `sdk/README.md` for the full method list.
