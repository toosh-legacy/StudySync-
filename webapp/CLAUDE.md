# StudySync — Complete Architecture & Build Guide
### The authoritative instruction set for Claude Code
### Read every section before writing any file

---

## How To Use This Guide

This document is written for Claude Code. Every section is a direct instruction.
When something is ambiguous, the rule is: ask before assuming. Never invent behaviour
not described here. Build in the exact phase order specified. Do not proceed to the
next phase until the current one is fully tested and working.

---

## Part 1 — Mental Model

### What StudySync does

A student opens the Chrome extension while studying. They select a course they have
added manually. They select which of their connected sources to include (Google Drive,
Notion, Canvas, Moodle, or the page they are currently viewing). They pick an output
format (flashcards, notes, study guide, practice questions, summary, or mind map) and
a depth level. They click Generate. Within seconds they receive structured study
material synthesised from all their connected sources.

### The data flow — understand this before everything else

The flow has four stages. Get this right and the rest follows naturally.

Stage 1 — SOURCE COLLECTION. When a student clicks Generate, the extension calls
the server at `/api/v1/sources/collect`. The server retrieves the stored OAuth tokens
for each requested provider from the database, fetches the relevant content from that
provider's API, caches it in the source_cache table, and returns the collected text
back to the extension. The extension also sends the current page content, which it
extracted itself using the content script.

Stage 2 — CONTENT BUNDLING. The extension now has a bundle of text content from all
sources. It sends this bundle along with the course ID, output format, and depth level
to `/api/v1/generate`.

Stage 3 — GENERATION. The API checks the cache first using a hash of all inputs. If
a matching cached output exists, it returns it immediately. If not, it calls OpenAI
gpt-4o-mini, parses the JSON response, saves the result to the database, and returns it.

Stage 4 — DISPLAY. The extension popup shows the generated output. The result is also
saved to the vault in the web app dashboard where the student can access it later.

### What the extension does and does not do

The extension DOES: extract current page text, show connected source status, send
collection and generation requests to the API, display results, store session state
in chrome.storage.local.

The extension DOES NOT: handle OAuth flows for any source provider (that is the web
app's job), store provider tokens, make direct calls to Google Drive or Notion APIs,
use setTimeout or global variables in the service worker.

### What the web app does

The web app is where students manage everything: connect sources via OAuth, add and
edit courses, view all generated outputs in the vault, manage their account and
preferences, and manage API keys for the public API.

---

## Part 2 — Pre-Build Checklist

Before writing any code, create all of these accounts. You need the credentials before
the first line runs.

### Accounts to create

Supabase: go to supabase.com and create a new project. Choose a region close to your
primary user base. Record the project URL, the anon/public key, and the service role
key. Never put the service role key in any client-side code or any environment variable
prefixed with NEXT_PUBLIC.

OpenAI: go to platform.openai.com and create an API key. The project should have
access to gpt-4o-mini and text-embedding-3-small.

Upstash: go to upstash.com and create a Redis database on the free tier. Record the
REST URL and REST token. This is used for rate limiting only.

Google Cloud Console: go to console.cloud.google.com. Create a new project named
StudySync. Enable the Google Drive API and the Google People API. Create OAuth 2.0
credentials of type Web Application. Add the Supabase callback URL as an authorised
redirect URI. The Supabase callback URL is your Supabase project URL followed by
/auth/v1/callback. Record the client ID and client secret.

Discord: go to discord.com/developers/applications. Create a new application. Under
OAuth2, add the Supabase callback URL as a redirect. Record the client ID and secret.

GitHub: go to github.com/settings/developers. Create a new OAuth App. Set the
homepage URL to your Vercel deployment URL (or localhost:3000 for development). Set
the callback URL to the Supabase callback URL. Record the client ID and secret.

Notion: go to notion.so/my-integrations and create a new public integration. Set the
redirect URI to your app URL followed by /api/v1/connections/notion/callback. Record
the OAuth client ID and client secret. Notion OAuth is separate from Supabase Auth.

### Configure Supabase Auth providers

In your Supabase dashboard go to Authentication > Providers. Enable Google, enter the
client ID and secret from Google Cloud Console. Enable Discord, enter the Discord
credentials. Enable GitHub, enter the GitHub credentials. Set the Site URL to your
Vercel deployment URL. Add your Vercel URL followed by /api/auth/callback to the
allowed redirect URLs list. Also add http://localhost:3000/api/auth/callback for
local development.

---

## Part 3 — Stack

| Concern | Technology | Notes |
|---|---|---|
| Framework | Next.js 14 App Router, TypeScript | Use App Router exclusively. No Pages Router. |
| Styling | Tailwind CSS + shadcn/ui | Run `npx shadcn-ui@latest init` after Next.js setup |
| Database | Supabase (PostgreSQL + pgvector + Auth) | One platform for DB, auth, storage, and realtime |
| AI | OpenAI gpt-4o-mini + text-embedding-3-small | gpt-4o-mini only unless noted. Never gpt-4o. |
| Validation | Zod | On every API route input, no exceptions |
| Rate limiting | Upstash Ratelimit | Free tier, no Redis server to manage |
| Extension | Chrome Manifest V3 + React + Vite | Separate build in /extension directory |
| Hosting | Vercel (web app) + Supabase (backend) | Both free tiers are sufficient for MVP |
| Payments | Stripe | Phase 2. Do not implement in MVP. |

---

## Part 4 — Complete File Structure

```
studysync/
│
├── .env.local                        ← Never commit (repo root)
├── webapp/
│   ├── CLAUDE.md                     ← This file
│   ├── .env.example                  ← Commit this with placeholder values
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   ├── middleware.ts                 ← Session refresh on every request
│   │
│   ├── app/
│   ├── layout.tsx                    ← Root layout with providers
│   ├── page.tsx                      ← Public landing page
│   │
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx              ← Three OAuth buttons
│   │   └── callback/
│   │       └── route.ts             ← Supabase auth code exchange
│   │
│   ├── (dashboard)/
│   │   ├── layout.tsx               ← Sidebar + auth guard
│   │   ├── dashboard/
│   │   │   └── page.tsx             ← Home stats + recent outputs
│   │   ├── vault/
│   │   │   └── page.tsx             ← All generated outputs
│   │   ├── courses/
│   │   │   └── page.tsx             ← Add/edit/delete courses
│   │   ├── connections/
│   │   │   └── page.tsx             ← Connect/disconnect all providers
│   │   ├── settings/
│   │   │   └── page.tsx             ← Profile + preferences
│   │   └── api-keys/
│   │       └── page.tsx             ← Create/revoke public API keys
│   │
│   └── api/
│       ├── auth/
│       │   └── callback/
│       │       └── route.ts
│       └── v1/
│           ├── generate/
│           │   └── route.ts         ← Main generation endpoint (POST)
│           ├── sources/
│           │   └── collect/
│           │       └── route.ts     ← Fetch content from all providers (POST)
│           ├── courses/
│           │   └── route.ts         ← GET (list) + POST (create)
│           ├── courses/[id]/
│           │   └── route.ts         ← GET + PATCH + DELETE
│           ├── connections/
│           │   └── route.ts         ← GET list of all providers + status
│           ├── connections/[provider]/
│           │   ├── route.ts         ← POST to initiate OAuth
│           │   ├── callback/
│           │   │   └── route.ts     ← GET OAuth callback + token storage
│           │   └── disconnect/
│           │       └── route.ts     ← DELETE stored tokens
│           ├── vault/
│           │   └── route.ts         ← GET generated outputs with filters
│           ├── vault/[id]/
│           │   └── route.ts         ← GET single output + DELETE
│           ├── keys/
│           │   └── route.ts         ← GET list + POST create
│           └── keys/[id]/
│               └── route.ts         ← DELETE (revoke)
│
│   ├── components/
│   ├── ui/                          ← shadcn/ui (auto-generated, do not edit)
│   ├── auth/
│   │   └── OAuthButton.tsx
│   ├── dashboard/
│   │   ├── Sidebar.tsx
│   │   ├── StatCard.tsx
│   │   ├── OutputCard.tsx
│   │   └── CourseForm.tsx
│   └── connections/
│       └── ProviderCard.tsx
│
│   ├── lib/
│   ├── supabase/
│   │   ├── server.ts               ← createServerClient using next/headers cookies
│   │   ├── client.ts               ← createBrowserClient singleton
│   │   └── admin.ts                ← createClient with service role key (server only)
│   ├── openai/
│   │   ├── client.ts               ← OpenAI singleton
│   │   ├── generate.ts             ← Generation pipeline
│   │   ├── embed.ts                ← Embedding with cache check
│   │   └── prompts.ts              ← All system prompts as constants
│   ├── connectors/
│   │   ├── types.ts                ← Shared connector interfaces
│   │   ├── google-drive.ts         ← Google Drive content fetcher
│   │   ├── notion.ts               ← Notion content fetcher
│   │   ├── canvas.ts               ← Canvas LMS content fetcher
│   │   └── moodle.ts               ← Moodle content fetcher
│   ├── auth.ts                     ← Dual auth helper (JWT + API key)
│   ├── cache.ts                    ← Cache key builder + lookup helpers
│   ├── ratelimit.ts                ← Upstash rate limit wrappers
│   └── errors.ts                   ← Standardised error response builder
│
├── types/
│   ├── database.ts                 ← Supabase generated types
│   ├── api.ts                      ← All Zod schemas for API I/O
│   └── connectors.ts               ← ConnectorResult, SourceContent types
│
└── extension/
    ├── manifest.json
    ├── package.json
  │   ├── extension/
  │   │   ├── vite.config.ts
  │   │   └── src/
        ├── background/
        │   └── service-worker.ts
        ├── content/
        │   └── content.ts
        └── popup/
            ├── index.html
            ├── main.tsx
            ├── App.tsx
            ├── components/
            │   ├── CourseSelector.tsx
            │   ├── SourceStatus.tsx
            │   ├── OutputPicker.tsx
            │   └── ResultView.tsx
            ├── hooks/
            │   ├── useCourses.ts
            │   ├── useConnections.ts
            │   └── useGenerate.ts
            └── lib/
                ├── api.ts          ← Typed fetch wrapper for the StudySync API
                └── storage.ts      ← chrome.storage.local typed wrappers
│
└── api/
  ├── package.json
  ├── tsconfig.json
  └── src/
```

---

## Part 5 — Environment Variables

Create `.env.local` at the repo root with these exact variable names. The `.env.example` file should
contain the same keys with empty or placeholder values and must be committed to git.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

OPENAI_API_KEY=

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=

NOTION_OAUTH_CLIENT_ID=
NOTION_OAUTH_CLIENT_SECRET=

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Note: Google and Discord and GitHub OAuth for user login is configured directly in the
Supabase dashboard, not in environment variables. The GOOGLE_DRIVE_CLIENT_ID and
GOOGLE_DRIVE_CLIENT_SECRET here are specifically for the Drive content connector,
which is a separate OAuth application with Drive read scope.

---

## Part 6 — Database Schema

Run every statement below in the Supabase SQL editor in the exact order shown.
Run it once. If you need to reset, delete the project and start fresh rather than
running partial drops.

```sql
CREATE EXTENSION IF NOT EXISTS "pgvector";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PROFILES
-- Created automatically by trigger when a user signs up.
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  avatar_url    TEXT,
  plan          TEXT NOT NULL DEFAULT 'free'
                CHECK (plan IN ('free','student','team','enterprise')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON public.profiles FOR ALL
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_preferences (user_id) VALUES (new.id);
  RETURN new;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- USER PREFERENCES
CREATE TABLE public.user_preferences (
  user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_format      TEXT NOT NULL DEFAULT 'flashcards',
  default_depth       TEXT NOT NULL DEFAULT 'standard',
  auto_scan_page      BOOLEAN NOT NULL DEFAULT TRUE,
  cache_outputs       BOOLEAN NOT NULL DEFAULT TRUE,
  spaced_repetition   BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prefs_own" ON public.user_preferences FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- COURSES
CREATE TABLE public.courses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code        TEXT,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#1D9E75',
  archived    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_courses_user ON public.courses(user_id);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courses_own" ON public.courses FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- SOURCE CONNECTIONS
-- One row per user per provider. Tokens stored encrypted.
-- provider values: google_drive, notion, canvas, moodle, obsidian
CREATE TABLE public.source_connections (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL
                   CHECK (provider IN ('google_drive','notion','canvas','moodle','obsidian')),
  connected        BOOLEAN NOT NULL DEFAULT FALSE,
  display_name     TEXT,
  detail_label     TEXT,
  access_token     TEXT,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  metadata         JSONB NOT NULL DEFAULT '{}',
  last_synced_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider)
);
CREATE INDEX idx_connections_user_provider ON public.source_connections(user_id, provider);
ALTER TABLE public.source_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "connections_own" ON public.source_connections FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- SOURCE CACHE
-- Stores fetched content from providers. Expires after 24 hours.
-- Prevents refetching identical content on every generation.
CREATE TABLE public.source_cache (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  source_key    TEXT NOT NULL,
  content_hash  TEXT NOT NULL,
  content       TEXT NOT NULL,
  source_name   TEXT NOT NULL,
  source_url    TEXT,
  embedding     VECTOR(1536),
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  UNIQUE (user_id, provider, source_key)
);
CREATE INDEX idx_source_cache_user ON public.source_cache(user_id);
CREATE INDEX idx_source_cache_embedding ON public.source_cache
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
ALTER TABLE public.source_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "source_cache_own" ON public.source_cache FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- GENERATED OUTPUTS
CREATE TABLE public.generated_outputs (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id          UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  cache_key          TEXT NOT NULL,
  output_format      TEXT NOT NULL
                     CHECK (output_format IN ('flashcards','study_guide','notes',
                       'practice_questions','summary','mind_map')),
  depth              TEXT NOT NULL DEFAULT 'standard'
                     CHECK (depth IN ('quick','standard','deep')),
  output             JSONB NOT NULL,
  sources_read       JSONB NOT NULL DEFAULT '[]',
  sources_used_count INTEGER NOT NULL DEFAULT 0,
  prompt_tokens      INTEGER,
  completion_tokens  INTEGER,
  model_used         TEXT,
  cache_hit          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_outputs_cache_key_user
  ON public.generated_outputs(cache_key, user_id);
CREATE INDEX idx_outputs_user ON public.generated_outputs(user_id);
CREATE INDEX idx_outputs_course ON public.generated_outputs(course_id);
CREATE INDEX idx_outputs_created ON public.generated_outputs(created_at DESC);
ALTER TABLE public.generated_outputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outputs_own" ON public.generated_outputs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- TOKEN USAGE
-- Tracks daily token spend per user for budget enforcement.
CREATE TABLE public.token_usage (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  tokens_used BIGINT NOT NULL DEFAULT 0,
  requests    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);
ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "token_usage_read_own" ON public.token_usage FOR SELECT
  USING (auth.uid() = user_id);

-- API KEYS
CREATE TABLE public.api_keys (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  key_prefix   TEXT NOT NULL,
  plan         TEXT NOT NULL DEFAULT 'developer',
  usage_count  BIGINT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  revoked      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_api_keys_user ON public.api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash);
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_keys_own" ON public.api_keys FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RPC: increment token usage (upsert pattern)
CREATE OR REPLACE FUNCTION public.increment_token_usage(
  p_user_id UUID,
  p_date    DATE,
  p_tokens  INTEGER
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.token_usage (user_id, date, tokens_used, requests)
  VALUES (p_user_id, p_date, p_tokens, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    tokens_used = token_usage.tokens_used + EXCLUDED.tokens_used,
    requests    = token_usage.requests    + 1;
END;
$$;
```

After running the schema, generate TypeScript types by running in the terminal:
`npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts`

---

## Part 7 — Project Setup Commands

Run these in order once the schema is in the database.

```
npx create-next-app@latest studysync --typescript --tailwind --app --no-src-dir
cd studysync
npm install @supabase/supabase-js @supabase/ssr
npm install openai
npm install zod
npm install @upstash/ratelimit @upstash/redis
npm install lucide-react
npm install class-variance-authority clsx tailwind-merge
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input label badge tabs dialog
npx shadcn-ui@latest add dropdown-menu separator avatar toast
```

---

## Part 8 — Phase 1: Foundation

Build these files first and verify each works before moving on.

### middleware.ts

This file must refresh the Supabase session on every request. Use the exact pattern
from the Supabase Next.js SSR documentation at supabase.com/docs/guides/auth/server-side/nextjs.
The middleware should match all paths except Next.js static files and image routes.
After refreshing the session, it should continue to the next middleware or the route.
It must not redirect unauthenticated users — that is the dashboard layout's job.

### lib/supabase/server.ts

Creates a Supabase client for use in Server Components and API routes. Uses the cookie
store from next/headers. Must be typed with the Database type from types/database.ts.
Uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.

### lib/supabase/client.ts

Creates a browser Supabase client as a singleton. Used in Client Components only.
Same keys as the server client. Must be typed with the Database type.

### lib/supabase/admin.ts

Creates a Supabase client using the service role key. This bypasses Row Level Security.
Only ever import this file in server-side code (API routes). Never in components.
Validate that SUPABASE_SERVICE_ROLE_KEY is not a NEXT_PUBLIC_ variable.

### lib/errors.ts

Defines the error response format used by every API route. Every error response must
follow this shape: `{ error: string, message: string, status: number }`. Define a
helper function called `apiError` that takes a code, message, and HTTP status and
returns a NextResponse with that JSON body and that status code. Define these error
codes as constants: UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR,
RATE_LIMITED, BUDGET_EXHAUSTED, NO_CONTENT, AI_UNAVAILABLE, INTERNAL_ERROR.
Never include stack traces, file paths, or internal details in error responses.

### lib/auth.ts

This file exports a single function called `authenticateRequest`. It takes a
NextRequest and returns either a user object with `userId` and `plan` fields, or null.

It tries authentication in this order:

First, it looks for an Authorization header starting with "Bearer ". It extracts the
JWT and calls `supabase.auth.getUser(token)` using the server client. If a user is
returned, it fetches the plan from the profiles table and returns the user object.

Second, if no Bearer header, it looks for an X-API-Key header. The key must be at
least 32 characters. It hashes the key using SHA-256, queries the api_keys table
using the admin client for a row with that hash where revoked is false. If found and
not expired, it increments the usage_count and updates last_used_at using a fire-and-
forget approach (do not await, do not let errors surface to the caller), then returns
the user object with the plan from the key record.

If neither method succeeds, return null.

### lib/ratelimit.ts

Uses @upstash/ratelimit and @upstash/redis. Create a rate limiter for the generate
endpoint allowing 10 requests per minute per user ID. Create a separate rate limiter
for general API routes allowing 60 requests per minute per IP address. Export both
as named constants. If Upstash credentials are not configured, the limiters should
fail open (allow the request through and log a warning) rather than blocking.

### lib/cache.ts

Exports a function called `buildCacheKey`. It takes course ID, output format, depth,
and an array of source content strings. It computes a SHA-256 hash of each content
string, sorts the hashes alphabetically, then computes a final SHA-256 hash of the
string formed by joining course ID, format, depth, and the sorted content hashes with
colon separators. Returns the hex string. The sort ensures that the same sources in
a different order produce the same cache key.

### app/(auth)/login/page.tsx

A centered page with three social login buttons: Continue with Google, Continue with
Discord, Continue with GitHub. Each button calls `supabase.auth.signInWithOAuth` with
the relevant provider and a redirectTo option pointing to the app URL followed by
/api/auth/callback. The page should be a Client Component because it uses the browser
Supabase client. If the user is already logged in, redirect to /dashboard.

### app/api/auth/callback/route.ts

Handles the OAuth redirect from Supabase. Receives a code in the search params.
Calls `supabase.auth.exchangeCodeForSession(code)`. Redirects to /dashboard on
success. Redirects to /login with an error param on failure.

### app/(dashboard)/layout.tsx

A Server Component. Creates a server Supabase client and calls
`supabase.auth.getUser()`. If no user is returned, redirect to /login. If a user is
returned, render the sidebar navigation and the children. The sidebar should have
links to: Dashboard, Vault, Courses, Connections, Settings, API Keys.

Verify this works by signing in with Google, landing on /dashboard, and confirming
the sidebar renders and the redirect works for unauthenticated requests.

---

## Part 9 — Phase 2: Courses API

### GET /api/v1/courses

Auth required (JWT or API key). Returns the list of non-archived courses for the
authenticated user, ordered by created_at descending. Response is an array of
course objects with fields: id, code, name, color, created_at.

### POST /api/v1/courses

Auth required. Accepts JSON body with fields: name (required, string, max 256 chars),
code (optional, string, max 16 chars, auto-uppercased), color (optional, hex string
defaulting to #1D9E75). Validate with Zod. Insert into courses table. Return the
created course object with 201 status.

### GET /api/v1/courses/[id]

Auth required. Fetch the course with the given ID belonging to the authenticated user.
Return 404 if not found or belongs to another user.

### PATCH /api/v1/courses/[id]

Auth required. Accepts partial body with any of: name, code, color, archived. Validate
with Zod. Update and return the updated course.

### DELETE /api/v1/courses/[id]

Auth required. Delete the course. Return 204 with no body on success.

### app/(dashboard)/courses/page.tsx

Server Component that fetches courses. Renders a list of course cards with color dot,
code, and name. Include an inline form for adding a course with a name input, optional
code input, and a color picker with six preset colors. Include edit and delete
functionality per card. After any mutation, revalidate the page using Next.js cache
revalidation. The form should submit to POST /api/v1/courses.

---

## Part 10 — Phase 3: Source Connections

This is the most complex part. Read it completely before building.

### Architecture of source connections

There are five providers: google_drive, notion, canvas, moodle, and obsidian. Each has
different authentication mechanisms. The connections page shows all five with their
current status. The extension only shows connected providers.

Google Drive uses full OAuth 2.0 with refresh tokens. The flow is handled server-side
using the googleapis Node.js library. Scopes needed: drive.readonly and
userinfo.email.

Notion uses its own OAuth flow, separate from the user's login. The flow is also
handled server-side. The @notionhq/client library is used for API calls. All requests
must include the Notion-Version header set to 2025-09-03.

Canvas uses an API token (personal access token), not OAuth. The student provides
their Canvas base URL (e.g. canvas.university.edu) and their personal access token
generated in Canvas settings. There is no OAuth redirect for Canvas.

Moodle also uses a token, specifically a Moodle Web Service token. The student
provides their Moodle base URL and a web service token. No OAuth for Moodle either.

Obsidian uses file sync. For MVP, the student can paste their Obsidian vault markdown
content directly into a text area in the connections page. It is stored as a single
blob in the source_connections metadata field. No API or OAuth.

### GET /api/v1/connections

Auth required. Returns an array of connection status objects for all five providers.
For each provider, include: provider name, connected boolean, display_name, detail_label,
last_synced_at. This is the endpoint the extension calls on popup open to determine
which source chips to show as active.

If a row does not exist in source_connections for a provider, include it in the response
with connected set to false and null for all other fields. Always return all five
providers.

### POST /api/v1/connections/google_drive

Auth required. Generates a Google OAuth URL and redirects the user to Google. The
OAuth URL must include: response_type=code, client_id, redirect_uri pointing to
/api/v1/connections/google_drive/callback, scope for drive.readonly and userinfo.email,
access_type=offline, prompt=consent. Store the user's ID in the state parameter of
the OAuth URL (base64 encoded) so it can be retrieved in the callback.

### GET /api/v1/connections/google_drive/callback

Receives code and state from Google. Extracts the user ID from the state. Exchanges
the code for tokens using the googleapis library. Fetches the user's email address
using the Google People API or userinfo endpoint. Upserts a row in source_connections
with provider=google_drive, connected=true, access_token, refresh_token,
token_expires_at, display_name set to the email address. Redirects to /connections
with a success toast parameter.

### DELETE /api/v1/connections/google_drive/disconnect

Auth required. Sets connected=false and clears access_token and refresh_token in the
source_connections row. Also deletes all rows in source_cache for this user where
provider=google_drive. Returns 204.

### POST /api/v1/connections/notion

Same pattern as Google Drive but using the Notion OAuth flow. The Notion OAuth
redirect URL must be registered in the Notion integration settings. After exchanging
the code, store the Notion access token (Notion does not use refresh tokens — access
tokens are long-lived). Fetch the workspace name from the Notion token response and
use it as the display_name.

### POST /api/v1/connections/canvas

Auth required. Accepts a JSON body with canvas_url (the full base URL of the
institution's Canvas instance, e.g. https://canvas.university.edu) and api_token
(the personal access token from Canvas). Validate both fields. Make a test call to
the Canvas API at [canvas_url]/api/v1/users/self using the token to confirm it works.
If the call succeeds, store in source_connections with provider=canvas, connected=true,
access_token set to the API token, display_name set to the user's name from Canvas,
detail_label set to the Canvas base URL. If the call fails, return 422 with a clear
message.

### POST /api/v1/connections/moodle

Same pattern as Canvas. Accepts moodle_url and web_service_token. Test by calling
the Moodle core_webservice_get_site_info function at
[moodle_url]/webservice/rest/server.php?wsfunction=core_webservice_get_site_info&
moodlewsrestformat=json&wstoken=[token]. If it returns a valid site info object,
store the connection. Use the site name as the detail_label.

### POST /api/v1/connections/obsidian

Auth required. Accepts a JSON body with content (the pasted vault content, up to
200,000 characters). Store in source_connections metadata field as a JSON object
with a single key called vault_content. Set connected=true, display_name=Obsidian
Vault, detail_label showing the character count. Returns 200 on success.

### app/(dashboard)/connections/page.tsx

Server Component. Shows five provider cards. Each card shows the provider logo
(use a simple colored icon, not an actual logo image due to brand restrictions),
connection status, account detail if connected, and the appropriate action button.

For Google Drive and Notion: the Connect button posts to the connect route which
redirects to OAuth. The Disconnect button calls the disconnect route.

For Canvas and Moodle: the Connect button opens a modal with a form for URL and
token. The form submits to the connect route. Validation errors are shown in the form.

For Obsidian: the Connect button opens a modal with a text area for pasting vault
content. The submit button calls the obsidian connect route.

When the page loads after a redirect from an OAuth callback, check for a success or
error query parameter and show a toast notification.

---

## Part 11 — Phase 4: Source Content Collection

This is the endpoint that sits between the extension and the generate endpoint.

### POST /api/v1/sources/collect

Auth required. This endpoint receives a list of providers the student has selected
and fetches content from each one. The extension calls this before calling generate.

Request body validated with Zod:
- course_id: UUID of the selected course
- providers: array of provider names to collect from (subset of connected providers only)
- current_page_content: optional string, the page content extracted by the content script
- current_page_url: optional string
- current_page_title: optional string

For each requested provider, the server:

1. Looks up the source_connections row. If not found or connected is false, skip that
   provider and add it to the skipped list. Do not error.
2. Checks if the token is expired and refreshes it if so (Google Drive only — see
   token refresh section below).
3. Calls the appropriate connector function to fetch content.
4. Checks the source_cache table for a non-expired row with matching user_id, provider,
   and source_key. If found and the content_hash matches what was just fetched, use
   the cached version rather than re-embedding.
5. If the content is new or changed, upsert into source_cache.
6. Appends the content to the collected array.

After all providers, if current_page_content was provided, append it as a source with
provider=current_page.

Response shape:
```json
{
  "collected": [
    {
      "provider": "google_drive",
      "source_name": "Week 3 Lecture Notes",
      "source_url": "https://...",
      "source_key": "google_drive_file_id",
      "content": "...",
      "characters": 4521,
      "from_cache": true
    }
  ],
  "skipped": [
    {
      "provider": "notion",
      "reason": "Token expired and refresh failed"
    }
  ],
  "total_characters": 12480
}
```

If total_characters exceeds 300,000, trim the content from each source proportionally
to bring the total under the limit and add a warning field to the response.

If all providers were skipped and no current_page_content was provided, return 422
with error code NO_CONTENT.

### Token refresh for Google Drive

Before making any Google Drive API call, check if token_expires_at is within 5 minutes
of the current time. If so, use the googleapis OAuth2 client to refresh the token
using the stored refresh_token. Update the source_connections row with the new
access_token and token_expires_at. If the refresh fails (invalid_grant error), set
connected=false in the database and skip this provider with reason "Token expired —
please reconnect Google Drive in the dashboard."

### Notion tokens

Notion access tokens do not expire. No refresh logic needed. If a Notion API call
returns 401, set connected=false and skip with reason "Notion access revoked — please
reconnect."

---

## Part 12 — Phase 5: Source Connectors

### lib/connectors/types.ts

Define these TypeScript interfaces. All connector functions must return ConnectorResult.

ConnectorResult has: items (array of CollectedItem), error (optional string).
CollectedItem has: source_key (string), source_name (string), source_url (optional
string), content (string).

### lib/connectors/google-drive.ts

This connector fetches text content from the user's Google Drive.

Install the googleapis package: `npm install googleapis`.

The function takes an access_token and refresh_token. It creates an OAuth2 client
using GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET, sets the credentials,
and initialises the Drive v3 API client.

It searches for files using the Drive files.list endpoint with the query:
mimeType='text/plain' or mimeType='application/vnd.google-apps.document'. It limits
to 20 files, ordered by modifiedTime descending, with fields: id, name, mimeType,
webViewLink, modifiedTime.

For each file, it downloads the content. For Google Docs (mimeType ending in
.document), it exports as text/plain using files.export. For plain text files, it
downloads using files.get with alt=media.

It trims each file's content to a maximum of 20,000 characters. If a file is larger,
take the first 10,000 and last 10,000 characters and join them with a separator
indicating content was trimmed.

The source_key for each item is the Drive file ID. The source_name is the file name.
The source_url is the webViewLink.

If any individual file download fails, skip that file and continue. If the files.list
call itself fails, return a ConnectorResult with an empty items array and the error
message.

### lib/connectors/notion.ts

Install @notionhq/client: `npm install @notionhq/client`.

The function takes an access_token. It creates a Notion client with that token.

It calls notion.search() with filter.property=object and filter.value=page, sorted by
last_edited_time descending, page_size=20.

For each page returned, it calls notion.blocks.children.list() with the page ID to
get the content blocks. It then extracts plain text from each block recursively. The
block types to handle are: paragraph, heading_1, heading_2, heading_3,
bulleted_list_item, numbered_list_item, toggle, quote, and callout. For each,
extract the rich_text array and join the plain_text values with spaces. Ignore blocks
of type image, video, file, embed, and divider.

Trim each page's content to 15,000 characters. The source_key is the page ID. The
source_name is the page title extracted from the properties.title field. The source_url
is the page URL constructed as https://notion.so/[page_id_without_hyphens].

If notion.blocks.children.list returns a has_more: true flag, fetch the next page
using the cursor parameter. Continue until has_more is false or 500 blocks have been
fetched, whichever comes first.

### lib/connectors/canvas.ts

The function takes an access_token (the Canvas API token) and a canvas_url (the base
URL of the Canvas instance).

Make all requests to [canvas_url]/api/v1/... with the header
`Authorization: Bearer [access_token]`. Canvas API uses link-header based pagination.

First, fetch the student's active courses: GET /api/v1/courses?enrollment_state=active
&per_page=20. This returns an array of course objects with id, name, and course_code.

For each course, fetch the modules: GET /api/v1/courses/[course_id]/modules?per_page=20.

For each module, fetch the module items: GET /api/v1/courses/[course_id]/modules/
[module_id]/items?per_page=50. Filter items where type is Page.

For each Page item, fetch the page content: GET /api/v1/courses/[course_id]/pages/
[page_url]. Extract the body field, which is HTML. Strip all HTML tags to get plain
text. Trim to 10,000 characters per page.

Limit total items fetched to 30 pages across all courses to avoid extremely long
collection times. The source_key for each item is canvas_[course_id]_[page_url].
The source_name is the module item title. The source_url is the html_url from the
page object.

If the Canvas API returns 401, stop and return error "Canvas token invalid".
If it returns 403, stop and return error "Canvas token does not have sufficient permissions".

### lib/connectors/moodle.ts

The function takes a web_service_token and a moodle_url.

All Moodle Web Service calls go to: [moodle_url]/webservice/rest/server.php with
query parameters: wsfunction=[function_name], moodlewsrestformat=json,
wstoken=[web_service_token], plus function-specific parameters.

First, get the user's enrolled courses: wsfunction=core_enrol_get_users_courses with
userid from wsfunction=core_webservice_get_site_info.

For each course, get course content sections: wsfunction=core_course_get_contents
with courseid=[course_id].

For each section's modules, look for modules with modname=page. For each page module,
the content is in the module's contents array where type=content. Extract the fileurl
and download the file using the token as a URL parameter for authentication.

Strip HTML from downloaded content. Trim to 10,000 characters per page. Limit to
25 total pages. Source key is moodle_[course_id]_[module_id].

### lib/connectors/obsidian.ts (trivial)

The function takes the vault_content string from the source_connections metadata field.
It returns a single CollectedItem with source_key=obsidian_vault, source_name=Obsidian
Vault, and the vault_content as the content. If vault_content is missing or empty,
return empty items with error "Obsidian vault content not found".

---

## Part 13 — Phase 6: Generation API

### lib/openai/prompts.ts

Define the system prompt for each output format as a named string constant. Each
prompt must instruct the model to return only valid JSON with no markdown, no preamble,
and no text outside the JSON object. Each prompt must define the exact JSON structure
expected. Each prompt must include a field called sources_used which is an array of
objects with source_name and relevance_note fields, where relevance_note is a one-
sentence description of how that source contributed to the output.

The six formats and their expected JSON structures:

Flashcards: `{ cards: [{front, back, topic}], total: number, sources_used: [...] }`

Study guide: `{ title, sections: [{heading, body, key_terms: []}], summary, sources_used: [...] }`

Notes (Cornell method): `{ title, cue_column: [], notes_column, summary, sources_used: [...] }`

Practice questions: `{ questions: [{question, answer, difficulty, topic}], total, sources_used: [...] }`

Summary: `{ headline, key_points: [], detail, sources_used: [...] }`

Mind map: `{ root: { concept, children: [{concept, children: [...]}] }, sources_used: [...] }`

### lib/openai/generate.ts

Exports a function called `callGenerate` that takes format, depth, source array, course
name, and an optional user prompt. It calls the OpenAI chat completions endpoint with
model gpt-4o-mini, max_tokens 4096, temperature 0.3, and response_format set to
{ type: "json_object" }. Returns the raw JSON string and the usage object.

The depth parameter maps to instructions appended to the user message:
- quick: "Be highly selective. Prioritise the most testable, exam-relevant content only."
- standard: "Cover the main concepts thoroughly without excessive detail."
- deep: "Be exhaustive. Include nuance, examples, edge cases, and connections between concepts."

The user message must contain: the course name, the depth instruction, any user prompt,
and the source content blocks separated by clear delimiters including the source name
and provider before each block.

If the API call throws an error with status 429, wait one second and retry once. If
the second attempt also fails or throws a different error, throw the error to the caller.

### POST /api/v1/generate

Auth required. Rate limited to 10 requests per minute per user.

Request body validated with Zod:
- course_id: UUID
- output_format: one of the six valid formats
- depth: quick, standard, or deep (default standard)
- sources: array of collected source objects (from the collect endpoint response)
  Each source has: provider, source_name, source_url (optional), content (max 50,000 chars)
- user_prompt: optional string, max 1,000 chars

Processing steps in order:

1. Authenticate the request. Return 401 if not authenticated.
2. Validate the request body with Zod. Return 422 with the first validation error if invalid.
3. Check that the total combined character count of all source content does not exceed
   300,000. If it does, return 422 with error explaining the limit.
4. Verify the course belongs to the authenticated user. Return 404 if not.
5. Compute the cache key using lib/cache.ts buildCacheKey.
6. Query generated_outputs for a matching cache_key and user_id. If found, return it
   immediately with cache_hit: true. Skip all remaining steps.
7. Check the token budget. Query token_usage for today's total for this user. Compare
   against the plan limit. If exceeded, return 429 with BUDGET_EXHAUSTED.
   Plan limits: free=100,000, student=500,000, team=2,000,000, enterprise=unlimited.
8. Build the prompt and call callGenerate from lib/openai/generate.ts.
9. If the call throws, check the error type. Connection errors → 503. Rate limit errors
   that persisted through one retry → 503. Any other errors → 500.
10. Parse the returned JSON string. If parsing fails, call callGenerate once more with
    an additional instruction in the prompt telling the model its previous response
    was not valid JSON. If parsing fails again, return 500.
11. Extract sources_used from the parsed object and delete the key from the object.
12. Build the sources_read array from the input sources. For each input source, find
    its matching entry in sources_used by source_name. If found, include the relevance_note.
    If not found, set relevance_note to "Read but not directly cited."
    Set status to "success" for all input sources.
13. Insert a row into generated_outputs with all fields including the cache key.
14. Call increment_token_usage RPC as a fire-and-forget (do not await, log errors only).
15. Return the response with all required fields.

Response shape:
```json
{
  "request_id": "uuid",
  "cache_hit": false,
  "course_id": "uuid",
  "output_format": "flashcards",
  "depth": "standard",
  "output": { ... format-specific content ... },
  "sources_read": [
    {
      "provider": "google_drive",
      "source_name": "Week 3 Notes",
      "source_url": "https://...",
      "characters_read": 4521,
      "status": "success",
      "relevance_note": "All flashcard content was drawn from this file."
    }
  ],
  "sources_used_count": 1,
  "usage": {
    "prompt_tokens": 1200,
    "completion_tokens": 800,
    "total_tokens": 2000,
    "estimated_cost_usd": 0.00066,
    "model": "gpt-4o-mini"
  },
  "generated_at": "2025-05-19T12:00:00Z"
}
```

Cost estimate formula: (prompt_tokens / 1,000,000 * 0.15) + (completion_tokens / 1,000,000 * 0.60)

---

## Part 14 — Phase 7: Vault and Settings

### GET /api/v1/vault

Auth required. Accepts optional query parameters: course_id (UUID), output_format
(one of the six), limit (integer default 20, max 100), offset (integer default 0).
Returns paginated list of generated outputs ordered by created_at descending.
Each item includes all fields except the full output JSONB (include only a preview
field with the first 200 characters of the stringified output JSON).

### GET /api/v1/vault/[id]

Auth required. Returns the full output object including the complete output field.
Returns 404 if not found or belongs to another user.

### DELETE /api/v1/vault/[id]

Auth required. Deletes the row. Returns 204. Does not delete the cache key — this
means if the same inputs are used again it will re-generate fresh.

### app/(dashboard)/vault/page.tsx

Server Component. Renders generated outputs with filters for course and format.
Each output card shows: output format badge with color, course name and code, depth
label, how many sources were used, time since generation, and a preview of the content.
Clicking a card expands it to show the full content rendered appropriately for its
format (flashcards as a card layout, notes in a two-column Cornell layout, practice
questions as a numbered list with expandable answers). Include a copy-to-clipboard
button and a download-as-markdown button per output.

### app/(dashboard)/settings/page.tsx

Renders: profile section (avatar, display_name, email, plan badge), preferences
section (toggles for auto_scan_page, cache_outputs, spaced_repetition), and a danger
zone section with a delete account button that requires typing the word DELETE to
confirm. Preferences are fetched from user_preferences and updated via PATCH requests.

### app/(dashboard)/api-keys/page.tsx

Renders the list of API keys with: label, key prefix (first 8 chars), plan, usage
count, last used date, expiry if set, and a revoke button. Includes a Create API Key
form with a label input. On creation, the server generates a cryptographically random
32-byte key, formats it as ss_live_[hex], hashes it with SHA-256, stores the hash and
prefix, and returns the full key ONCE in the response. The UI must display the key
prominently and warn the user to copy it immediately as it will not be shown again.

---

## Part 15 — Phase 8: Web App Pages Completion

### app/(dashboard)/dashboard/page.tsx

Server Component. Shows four stat cards: total generations this month (query
generated_outputs), total courses (query courses), connected sources (query
source_connections where connected=true), and tokens used today (query token_usage).
Below the stats, show the five most recent generated_outputs as compact cards linking
to the vault. Include a quick-generate panel where the student can select a course
from a dropdown and a format from radio buttons and click Generate, which redirects
to the extension or to a generation flow.

### Landing page (app/page.tsx)

Public page visible before login. Shows the product name, a one-line description,
three feature highlights, and a Get Started button linking to /login. Keep it minimal.
This is not a marketing page — it is just an entry point.

---

## Part 16 — Phase 9: Chrome Extension

Build the extension in the /extension directory as a completely separate project.
Do not mix extension source files with the Next.js app.

### Setup

```
cd extension
npm create vite@latest . -- --template react-ts
npm install @supabase/supabase-js
```

The extension build output goes to extension/dist. This dist folder is what gets
loaded in Chrome and submitted to the Chrome Web Store.

### extension/manifest.json

The manifest must declare:
- manifest_version: 3
- name: StudySync
- version: 1.0.0
- permissions: storage, activeTab, identity, alarms
- host_permissions: the full Vercel deployment URL followed by /api/* (exact match)
- background service_worker pointing to the built service worker file
- action with default_popup pointing to popup.html
- content_scripts array with a match for all URLs, pointing to the content script

The host_permissions must be specific to your domain. Do not use wildcards like
<all_urls> — only request permission for your own API domain.

### extension/src/background/service-worker.ts

The rules for MV3 service workers are absolute. Follow them without exception:

Rule 1: Register every event listener synchronously at the top level of the file.
Never register a listener inside an async function, a promise callback, or a setTimeout.

Rule 2: Never store state in module-level variables. The service worker terminates
after 30 seconds of inactivity. Any variable value is lost. All persistent state goes
in chrome.storage.local.

Rule 3: Never use setTimeout or setInterval. Use chrome.alarms for any time-based logic.

Rule 4: Always return true from onMessage listeners that call sendResponse asynchronously.

The service worker handles these events:

chrome.runtime.onInstalled: Sets initial storage values if not already set. Stores
version number and initialized flag.

chrome.runtime.onMessage: Handles two message types.
- EXTRACT_CONTENT: Forwards to the content script in the active tab using
  chrome.tabs.sendMessage, returns the result.
- GET_STORAGE: Returns a value from chrome.storage.local by key.

chrome.alarms.onAlarm: Handles the refresh-connections alarm by fetching fresh
connection data from the API and storing it in chrome.storage.local. This keeps the
popup's source chips up to date without requiring a network call on every popup open.

chrome.alarms.create: On install, create an alarm called refresh-connections that
fires every 10 minutes.

### extension/src/content/content.ts

The content script runs in the context of every page. It listens for the
EXTRACT_CONTENT message from the service worker.

When it receives the message, it extracts content by: removing all script, style, nav,
footer, and aside elements from a document clone. Then it takes the textContent of the
main element, falling back to article, then to body. It trims the result and limits
it to 40,000 characters. It also captures: document.title, window.location.href,
and attempts to identify the page type (canvas, moodle, youtube, article, or generic)
by checking the URL and the presence of known DOM patterns.

It returns an object with: title, url, content, page_type, character_count.

### extension/src/popup/lib/api.ts

A typed fetch wrapper. All API calls from the popup go through this file. It reads
the session token from chrome.storage.local. It attaches the Authorization header.
It handles errors by parsing the JSON error body and throwing a typed error object.
It exports functions: getCourses, getConnections, collectSources, generate.

### extension/src/popup/lib/storage.ts

Typed wrappers around chrome.storage.local.get and chrome.storage.local.set for the
keys the popup uses: session_token, courses_cache, courses_cached_at,
connections_cache, connections_cached_at, preferences.

### extension/src/popup/hooks/useCourses.ts

A React hook. On mount, checks chrome.storage.local for a cached courses array and
a courses_cached_at timestamp. If the cache is less than 10 minutes old, returns the
cached data. Otherwise, calls getCourses from api.ts, stores the result and the
current timestamp in storage, and returns the data.

### extension/src/popup/hooks/useConnections.ts

Same pattern as useCourses but for the connections array. Cache duration is 5 minutes.
Returns only connections where connected is true. These are the only providers shown
as selectable in the popup.

### extension/src/popup/hooks/useGenerate.ts

A React hook that manages the generation flow. It exposes:
- selectedCourse state
- selectedFormat state
- selectedDepth state
- selectedProviders state (set of provider names)
- result state (the generation response or null)
- status state (idle, collecting, generating, done, error)
- errorMessage state
- generate function

The generate function: (1) sets status to collecting, (2) sends EXTRACT_CONTENT
message to the service worker to get the current page content, (3) calls collectSources
with the selected providers and current page content, (4) if the collect response has
no content, sets an error, (5) sets status to generating, (6) calls generate with the
collected sources, (7) sets result and status to done.

### extension/src/popup/App.tsx

The root popup component. Uses the three hooks. Renders:

Header bar with logo, external link to dashboard, and account settings icon.

Tab bar with Generate and Account tabs.

On the Generate tab:
- Course selector: A search input that filters a scrollable list. Each course shows
  its color dot, code, and name. Clicking selects it. The selected course shows a
  checkmark. An add-course row below the list shows a short code input and a longer
  name input with an Add button. Adding a course calls the POST /api/v1/courses
  endpoint and updates the local cache.
- Source status: Shows one row per connected provider (from useConnections). Each row
  shows the provider icon, name, and account detail. It has a checkbox to include or
  exclude it. At least one must always be selected. Disconnected providers are not
  shown at all. A link below says "Connect more sources in dashboard →".
- Output format: A 2×3 grid of format cards. Single select.
- Depth selector: Three buttons (Quick, Standard, Deep).

On the Account tab:
- User avatar and display name from storage.
- Three preference toggles: auto-scan page, cache outputs, spaced repetition.
- A link to open the dashboard.

Footer: Shows the selected course name and source count. The Generate button is
disabled until a course is selected. During collection and generation, show a spinner
and the current status text.

Result view: When result is not null, replace the main content with the result view.
Show the generated content formatted for its type. Show a back button to return to
the form. Show a view-in-vault button that opens the dashboard vault at the specific
output.

### Auth flow between web app and extension

The extension cannot initiate OAuth itself. When the extension popup opens, it first
checks chrome.storage.local for a session_token. If none is found, it shows a sign-in
prompt with a single button "Sign in to StudySync". Clicking this button calls
chrome.tabs.create to open the StudySync login page in a new tab. After the user
signs in on the web app, the web app writes the session token to a URL parameter in
a redirect to a special page at /extension/auth-complete?token=[jwt]. This page is
a simple Next.js page that uses postMessage to send the token to the extension, or
stores it in a way the extension can retrieve. The cleanest approach: the auth-complete
page calls a page action or uses the chrome extension ID (stored as NEXT_PUBLIC
env var) to send a message directly to the extension using chrome.runtime.sendMessage.
The service worker listens for this message and stores the token in chrome.storage.local.

For development, the simpler approach is to have the user copy the JWT from the
Supabase dashboard and paste it into a dev-mode token field in the extension popup.
Implement the proper flow before publishing to the Chrome Web Store.

---

## Part 17 — Testing

### What to test and how

Install vitest for the Next.js project: `npm install -D vitest @vitejs/plugin-react`.
Create vitest.config.ts at the root. Tests go in a __tests__ directory or alongside
source files with .test.ts extensions.

Tests to write for the API:

lib/cache.ts buildCacheKey: Verify that the same inputs always produce the same key.
Verify that different inputs produce different keys. Verify that source order does not
affect the key (sort stability test — pass [A, B] and [B, A], expect same result).

lib/errors.ts apiError: Verify each error code produces the correct HTTP status.
Verify no error response contains a stack trace.

Zod schemas in types/api.ts: Write at least three valid and three invalid cases for
the generate route input schema. Test the boundary cases: sources array length 1 and
10 (valid), length 0 and 11 (invalid), content length at limit (valid), one character
over limit (invalid).

app/api/v1/generate route: Mock the OpenAI client and the Supabase client. Test:
unauthenticated request returns 401, validation error returns 422 with field path,
cache hit returns immediately with cache_hit: true, budget exceeded returns 429,
successful generation saves to database and returns correct shape, JSON parse failure
triggers one retry and then returns 500 if retry also fails, OpenAI rate limit returns
503 with retry_after.

app/api/v1/sources/collect route: Mock all four connector functions. Test: missing
connection skips provider gracefully, expired token triggers refresh, successful
collection returns correct shape, all providers skipped returns 422.

Each connector function: Test the happy path with mocked HTTP responses. Test 401
returns the correct error string. Test empty content returns an empty items array.

Extension tests: Use jest-chrome package to mock chrome APIs. Test service worker
event registration is synchronous. Test useCourses returns cached data within 10
minutes. Test useGenerate transitions through all status states correctly.

---

## Part 18 — Claude Code Failure Prevention

These are the exact mistakes Claude Code makes on projects like this without explicit
instruction. Every item here must be treated as a hard rule.

Do not use Pages Router. Use App Router exclusively. All routes go under the app/
directory.

Do not store the Supabase service role key in any client-side file or any variable
prefixed with NEXT_PUBLIC_. If you find yourself doing this, stop and restructure.

Do not register event listeners in the service worker inside async functions, promise
callbacks, or event handler callbacks. Every listener must be registered at the top
level synchronously.

Do not use setTimeout or setInterval in the extension service worker. Use chrome.alarms.

Do not use global variables in the service worker to store state between events.
Use chrome.storage.local.

Do not call OpenAI with the gpt-4o model. Always use gpt-4o-mini unless there is an
explicit comment explaining a specific reason for upgrading.

Do not skip the cache key check in the generate route. It must happen before the
OpenAI call on every request without exception.

Do not let the generate route call generate even when there are no sources. If the
sources array is empty after the collection step, return an error.

Do not return raw error messages or stack traces from API routes. Always use the
apiError helper from lib/errors.ts.

Do not build the Canvas or Moodle connections using OAuth. They use API tokens
submitted through a form in the dashboard.

Do not let the extension make direct calls to Google Drive, Notion, Canvas, or Moodle
APIs. All connector logic runs server-side. The extension only calls /api/v1/sources/
collect and /api/v1/generate.

Do not mark source_connections rows as connected=true without first validating the
credentials actually work by making a test API call to the provider.

Do not let the Notion connector skip block children pagination. Always follow the
has_more cursor until complete or the 500-block limit is reached.

Do not skip Row Level Security. Every table must have RLS enabled and at least one
policy. Use the admin client only in server-side code when you genuinely need to
bypass RLS.

---

## Part 19 — Deployment

### Web app deployment

Push the repository to GitHub. Go to vercel.com and import the repository. In the
Vercel project settings, add every environment variable from .env.local. Set the
framework preset to Next.js. The build command is `next build`. The output directory
is .next.

After the first deployment, update the Supabase Auth settings: set the Site URL to
the Vercel deployment URL and add the deployment URL followed by /api/auth/callback
to the allowed redirect URLs list.

Also update the Google Cloud Console OAuth credentials to add the Vercel callback URL
as an authorised redirect URI.

Update the Notion integration to add the Vercel callback URL as a redirect URI.

### Extension deployment

Build the extension: `cd extension && npm run build`. The dist folder contains the
built extension. Load it in Chrome at chrome://extensions with developer mode enabled
to test it against the deployed web app.

Before submitting to the Chrome Web Store, update the manifest.json host_permissions
to match the exact Vercel deployment URL. Submit the dist folder (zipped) to the
Chrome Web Store developer dashboard. The $5 developer registration fee is a one-time
payment.

---

## Part 20 — Build Order Summary

Follow this order exactly. Do not skip ahead.

Phase 1: Project setup commands, environment variables, database schema, TypeScript
types generation, lib/supabase files, lib/errors.ts, lib/auth.ts, middleware.ts,
login page, auth callback route, dashboard layout with auth guard. TEST: sign in
and land on dashboard.

Phase 2: Courses API routes, courses dashboard page. TEST: add a course and see it
appear.

Phase 3: Connections API routes, connector validation calls, connections dashboard
page with all five provider cards. TEST: connect Google Drive, confirm row appears
in source_connections, disconnect and confirm it clears.

Phase 4: All four connector libraries (google-drive, notion, canvas, moodle, obsidian).
Sources collect route. TEST: generate a mock collect call and confirm content returns.

Phase 5: lib/openai files, lib/cache.ts, generate route. Vault routes. Vault page.
TEST: send a generate request with Postman or curl and confirm output saves and returns.
TEST: send the same request again and confirm cache_hit is true.

Phase 6: Settings page, API keys page. Dashboard home page. Landing page. TEST: all
pages render, preferences save, API key generates and is returned once.

Phase 7: Extension. Service worker, content script, popup with all components and
hooks. TEST: install unpacked extension, sign in via web app, open popup, add a course,
select sources, click generate, confirm result appears.

Phase 8: Write tests. Fix anything the tests reveal.

Phase 9: Deploy web app to Vercel. Update all OAuth redirect URLs. Build and load
extension against production. Submit extension to Chrome Web Store.
