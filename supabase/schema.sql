-- StudySync database schema
-- Run all statements once in the Supabase SQL editor, in order.
-- If you need to reset, delete the project and start fresh rather than running partial drops.

CREATE EXTENSION IF NOT EXISTS "vector";
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

-- RPC: increment api key usage_count and stamp last_used_at atomically.
CREATE OR REPLACE FUNCTION public.increment_api_key_usage(
  p_id UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.api_keys
     SET usage_count  = usage_count + 1,
         last_used_at = NOW()
   WHERE id = p_id;
END;
$$;

-- Public share toggle for generated outputs.
-- Run if this column does not exist yet:
ALTER TABLE public.generated_outputs
  ADD COLUMN IF NOT EXISTS public_share BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_outputs_public_share
  ON public.generated_outputs(public_share)
  WHERE public_share = TRUE;
-- Permissive read policy when public_share is true. Owner policy remains in place.
DROP POLICY IF EXISTS "outputs_public_read" ON public.generated_outputs;
CREATE POLICY "outputs_public_read" ON public.generated_outputs FOR SELECT
  USING (public_share = TRUE);
