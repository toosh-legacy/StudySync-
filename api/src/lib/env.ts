// Startup environment validation. Fails fast with a clear message if a required
// variable is missing, instead of throwing deep inside a request later.

interface EnvCheck {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

function firstPresent(...names: string[]): boolean {
  return names.some((n) => {
    const v = process.env[n];
    return typeof v === 'string' && v.length > 0;
  });
}

export function checkEnv(): EnvCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!firstPresent('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL')) {
    errors.push('SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) is required');
  }
  if (!firstPresent('SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY')) {
    errors.push('SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) is required');
  }
  if (!firstPresent('SUPABASE_SERVICE_ROLE_KEY')) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is required');
  }
  if (!firstPresent('OPENAI_API_KEY')) {
    errors.push('OPENAI_API_KEY is required');
  }

  if (!firstPresent('UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN')) {
    warnings.push('Upstash not configured — rate limiting will fail open.');
  }
  if (!firstPresent('TOKEN_ENCRYPTION_KEY')) {
    warnings.push('TOKEN_ENCRYPTION_KEY not set — provider tokens stored as plaintext.');
  }
  if (!firstPresent('WEBHOOK_SIGNING_SECRET')) {
    warnings.push('WEBHOOK_SIGNING_SECRET not set — webhooks signed with the service-role key.');
  }
  if (!firstPresent('GOOGLE_DRIVE_CLIENT_ID')) {
    warnings.push('GOOGLE_DRIVE_CLIENT_ID not set — Google Drive connector disabled.');
  }
  if (!firstPresent('NOTION_OAUTH_CLIENT_ID')) {
    warnings.push('NOTION_OAUTH_CLIENT_ID not set — Notion connector disabled.');
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Public base URL of this API, used for OAuth redirects, the OpenAPI server URL,
 * and async-job webhook callbacks. Prefers an explicit API_PUBLIC_URL, then falls
 * back to RENDER_EXTERNAL_URL (auto-injected by Render) so the service is
 * zero-config on that platform, then to localhost for local dev.
 */
export function publicBaseUrl(): string {
  return (
    process.env.API_PUBLIC_URL ??
    process.env.RENDER_EXTERNAL_URL ??
    'http://localhost:3001'
  );
}

/** Validate required env and exit the process if anything mandatory is missing. */
export function assertEnv(): void {
  const { ok, errors, warnings } = checkEnv();
  for (const w of warnings) console.warn(`[env] warning: ${w}`);
  if (!ok) {
    console.error('[env] Missing required configuration:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
}
