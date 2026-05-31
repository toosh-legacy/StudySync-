# StudySync API Reference

The StudySync API has two surfaces:

1. **Public BYO-LLM-key endpoint** — no auth, caller provides their own OpenAI
   key. This is the primary way to integrate StudySync into your own app.
2. **Authenticated endpoints** — power the web app and Chrome extension.
   Use a Supabase JWT (`Authorization: Bearer <jwt>`) or a StudySync API key
   (`X-API-Key: <key>`). Documented here for completeness.

- **Base URL:** `https://studysync-api-0lru.onrender.com`
- **Local dev:** `http://localhost:8787`
- **OpenAPI spec:** `GET /v1/openapi.json`

---

## 1. Public endpoint (BYO LLM key)

### `POST /v1/public/generate`

Generate structured study material in a single request. Bring your own OpenAI
key — StudySync never stores it or bills against it.

**Request body**

| Field           | Type   | Required | Notes                                                            |
| --------------- | ------ | -------- | ---------------------------------------------------------------- |
| `llm_key`       | string | yes      | Your OpenAI API key. Used only for this request.                 |
| `content`       | string | yes      | Raw study material. Max 300,000 characters.                      |
| `output_format` | enum   | yes      | See formats below.                                               |
| `depth`         | enum   | no       | `quick` · `standard` (default) · `deep`.                         |
| `user_prompt`   | string | no       | Extra instructions. Max 1,000 chars.                             |
| `model`         | string | no       | OpenAI model id. Default `gpt-4o-mini`.                          |

**Output formats**

| `output_format`      | Returns                                              |
| -------------------- | ---------------------------------------------------- |
| `flashcards`         | `{ cards: [{front, back, topic}], total }`           |
| `study_guide`        | `{ title, sections: [{heading, body, key_terms}], summary }` |
| `notes`              | `{ title, cue_column, notes_column, summary }`       |
| `practice_questions` | `{ questions: [{question, answer, difficulty, topic}], total }` |
| `summary`            | `{ headline, key_points, detail }`                   |
| `mind_map`           | `{ root: { concept, children: [...] } }`             |

**Example**

```bash
curl -X POST https://studysync-api-0lru.onrender.com/v1/public/generate \
  -H "Content-Type: application/json" \
  -d '{
    "llm_key": "sk-...",
    "content": "Mitochondria are the powerhouse of the cell...",
    "output_format": "flashcards",
    "depth": "standard"
  }'
```

**Response**

```json
{
  "output_format": "flashcards",
  "depth": "standard",
  "output": {
    "cards": [
      { "front": "What do mitochondria produce?", "back": "ATP via oxidative phosphorylation.", "topic": "Cell biology" }
    ],
    "total": 1
  },
  "usage": {
    "prompt_tokens": 312,
    "completion_tokens": 184,
    "total_tokens": 496,
    "model": "gpt-4o-mini"
  }
}
```

**Errors**

All errors return `{ "error": string, "message": string, "status": number }`.

| Status | Meaning                                       |
| ------ | --------------------------------------------- |
| 401    | Invalid `llm_key`                             |
| 422    | Validation error                              |
| 429    | OpenAI rate limit                             |
| 502    | LLM returned invalid JSON                     |
| 503    | OpenAI unreachable                            |

---

## 2. Authenticated endpoints

Used by the web app + extension. Every request needs either:

- `Authorization: Bearer <supabase-jwt>`, or
- `X-API-Key: <studysync-api-key>` (32+ chars, created in the web app).

All responses are JSON. All errors follow the shape above.

### Health

| Method | Path           | Description       |
| ------ | -------------- | ----------------- |
| GET    | `/v1/healthz`  | Liveness probe    |

### Profile & preferences

| Method | Path                | Description                        |
| ------ | ------------------- | ---------------------------------- |
| GET    | `/v1/profile`       | Current user profile               |
| PATCH  | `/v1/profile`       | Update display name / avatar       |
| GET    | `/v1/preferences`   | User preferences                   |
| PATCH  | `/v1/preferences`   | Update preferences                 |

### Courses

| Method | Path                 | Description           |
| ------ | -------------------- | --------------------- |
| GET    | `/v1/courses`        | List user courses     |
| POST   | `/v1/courses`        | Create a course       |
| GET    | `/v1/courses/:id`    | Get one course        |
| PATCH  | `/v1/courses/:id`    | Update a course       |
| DELETE | `/v1/courses/:id`    | Delete a course       |

### Connections

| Method | Path                                       | Description                       |
| ------ | ------------------------------------------ | --------------------------------- |
| GET    | `/v1/connections`                          | Status of all 5 providers         |
| POST   | `/v1/connections/:provider`                | Start OAuth or save token         |
| GET    | `/v1/connections/:provider/callback`       | OAuth callback                    |
| DELETE | `/v1/connections/:provider/disconnect`     | Disconnect provider               |

Providers: `google_drive`, `notion`, `canvas`, `moodle`, `obsidian`.

### Sources

| Method | Path                       | Description                                       |
| ------ | -------------------------- | ------------------------------------------------- |
| POST   | `/v1/sources/collect`      | Fetch content from selected connected providers   |

### Generation (auth required, ties output to the user's course + vault)

| Method | Path                    | Description                                              |
| ------ | ----------------------- | -------------------------------------------------------- |
| POST   | `/v1/generate`          | Synchronous generation. Body: course_id, output_format, depth, comprehension, sources, optional user_prompt, optional model. Supports `Idempotency-Key` header. |
| POST   | `/v1/generate/stream`   | SSE-streamed generation. Same body.                      |
| POST   | `/v1/generate/jobs`     | Async job. Returns `{ job_id, status: "queued" }` (202). |
| GET    | `/v1/generate/jobs/:id` | Poll job status. Optional `callback_url` in create body for webhook delivery. |

Requires scopes `generate:read` / `generate:write` on the API key. Generations
are cached by a hash of inputs — a repeated request returns `cache_hit: true`
instantly.

### Vault

| Method | Path                | Description                                        |
| ------ | ------------------- | -------------------------------------------------- |
| GET    | `/v1/vault`         | List generated outputs (filters: course_id, output_format, limit, offset) |
| GET    | `/v1/vault/:id`     | Get full output                                    |
| DELETE | `/v1/vault/:id`     | Delete output                                      |

### Shares, dashboard, usage, keys, meta

| Method | Path               | Description                                  |
| ------ | ------------------ | -------------------------------------------- |
| *      | `/v1/shares`       | Public read-only share links for outputs     |
| GET    | `/v1/dashboard`    | Stats for the dashboard home                 |
| GET    | `/v1/usage`        | Token usage per day                          |
| *      | `/v1/keys`         | List / create / revoke StudySync API keys    |
| GET    | `/v1/meta/formats` | Self-describing format catalogue             |

---

## Plans & limits

| Plan        | Daily token budget |
| ----------- | ------------------ |
| free        | 100,000            |
| student     | 500,000            |
| team        | 2,000,000          |
| enterprise  | unlimited          |

- Sync generation: rate-limited per user (default 10/min; per-key override possible).
- Per-IP coarse limit across the whole API (60/min, fails open if Upstash not configured).
- Public endpoint (`/v1/public/generate`) inherits the per-IP limit but has no
  per-user budget — the caller's OpenAI key is what gets billed.

---

## Error codes

| Code                | HTTP | Meaning                                       |
| ------------------- | ---- | --------------------------------------------- |
| `UNAUTHORIZED`      | 401  | Missing or invalid credentials                |
| `FORBIDDEN`         | 403  | Missing scope or plan-gated model             |
| `NOT_FOUND`         | 404  | Resource does not exist for this user         |
| `VALIDATION_ERROR`  | 422  | Body failed schema / size check               |
| `RATE_LIMITED`      | 429  | Per-user, per-key, or per-IP rate limit hit   |
| `BUDGET_EXHAUSTED`  | 429  | Daily token budget exceeded                   |
| `NO_CONTENT`        | 422  | All providers skipped and no page content     |
| `AI_UNAVAILABLE`    | 503  | OpenAI unreachable or throttled               |
| `INTERNAL_ERROR`    | 500  | Unexpected server error                       |

---

## Local development

```bash
cd api
npm install
cp .env.example .env   # fill in Supabase + OpenAI + Upstash keys
npm run dev            # http://localhost:8787
npm run typecheck
npm test
npm run smoke          # end-to-end live test
```

The OpenAPI spec is regenerated on every boot and served at `/v1/openapi.json`.
Dump a static copy with `npm run openapi:dump`.
