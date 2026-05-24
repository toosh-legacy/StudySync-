import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { createAdminClient } from '../lib/supabase.js';
import { apiError, ErrorCode } from '../lib/errors.js';
import { getUser, parseJson, sendError } from '../lib/http.js';
import {
  canvasConnectSchema,
  moodleConnectSchema,
  obsidianConnectSchema,
} from '../types/api.js';
import { buildGoogleAuthUrl, exchangeGoogleCode } from '../lib/oauth/google.js';
import { buildNotionAuthUrl, exchangeNotionCode } from '../lib/oauth/notion.js';
import { signOAuthState, verifyOAuthState } from '../lib/oauth/state.js';
import { encryptSecret } from '../lib/crypto.js';
import { publicBaseUrl } from '../lib/env.js';

type Provider = 'google_drive' | 'notion' | 'canvas' | 'moodle' | 'obsidian';
const ALL_PROVIDERS: readonly Provider[] = [
  'google_drive',
  'notion',
  'canvas',
  'moodle',
  'obsidian',
] as const;
const VALID = new Set<Provider>(ALL_PROVIDERS);

function apiPublicUrl(): string {
  return publicBaseUrl();
}

function webAppUrl(): string {
  return process.env.WEB_APP_URL ?? 'http://localhost:3000';
}

function redirectToConnections(
  status: 'success' | 'error',
  provider: string,
  message?: string,
): URL {
  const url = new URL('/connections', webAppUrl());
  url.searchParams.set('connect', provider);
  url.searchParams.set('status', status);
  if (message) url.searchParams.set('message', message);
  return url;
}

// ---- AUTHENTICATED ROUTES ----

const authedRouter = new Hono();
authedRouter.use('*', requireAuth);

authedRouter.get('/', async (c) => {
  const user = getUser(c);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('source_connections')
    .select('provider, connected, display_name, detail_label, last_synced_at')
    .eq('user_id', user.userId);

  if (error) {
    return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'Failed to load connections', 500));
  }

  const byProvider = new Map(data.map((row) => [row.provider, row]));
  const response = ALL_PROVIDERS.map((provider) => {
    const row = byProvider.get(provider);
    return {
      provider,
      connected: row?.connected ?? false,
      display_name: row?.display_name ?? null,
      detail_label: row?.detail_label ?? null,
      last_synced_at: row?.last_synced_at ?? null,
    };
  });
  return c.json(response);
});

authedRouter.post('/:provider', async (c) => {
  const user = getUser(c);
  const provider = c.req.param('provider');
  if (!VALID.has(provider as Provider)) {
    return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Unknown provider', 404));
  }

  const base = apiPublicUrl();

  if (provider === 'google_drive') {
    const state = signOAuthState({ userId: user.userId, provider });
    const url = buildGoogleAuthUrl(`${base}/v1/connections/google_drive/callback`, state);
    return c.json({ redirect_url: url });
  }

  if (provider === 'notion') {
    const state = signOAuthState({ userId: user.userId, provider });
    const url = buildNotionAuthUrl(`${base}/v1/connections/notion/callback`, state);
    return c.json({ redirect_url: url });
  }

  if (provider === 'canvas') {
    const parsed = await parseJson(c, canvasConnectSchema);
    if ('error' in parsed) return sendError(c, parsed.error);
    const cleanUrl = parsed.data.canvas_url.replace(/\/+$/, '');

    const probe = await fetch(`${cleanUrl}/api/v1/users/self`, {
      headers: { Authorization: `Bearer ${parsed.data.api_token}` },
    }).catch(() => null);
    if (!probe || !probe.ok) {
      return sendError(
        c,
        apiError(
          ErrorCode.VALIDATION_ERROR,
          'Could not authenticate to Canvas with the provided URL + token',
          422,
        ),
      );
    }
    const userInfo = (await probe.json()) as { name?: string; id?: number };

    const admin = createAdminClient();
    const { error } = await admin.from('source_connections').upsert(
      {
        user_id: user.userId,
        provider,
        connected: true,
        display_name: userInfo.name ?? 'Canvas user',
        detail_label: cleanUrl,
        access_token: encryptSecret(parsed.data.api_token),
        metadata: { canvas_url: cleanUrl, canvas_user_id: userInfo.id ?? null },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' },
    );
    if (error) {
      return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'Failed to save connection', 500));
    }
    return c.json({ ok: true });
  }

  if (provider === 'moodle') {
    const parsed = await parseJson(c, moodleConnectSchema);
    if ('error' in parsed) return sendError(c, parsed.error);
    const cleanUrl = parsed.data.moodle_url.replace(/\/+$/, '');

    const probeUrl = new URL(`${cleanUrl}/webservice/rest/server.php`);
    probeUrl.searchParams.set('wsfunction', 'core_webservice_get_site_info');
    probeUrl.searchParams.set('moodlewsrestformat', 'json');
    probeUrl.searchParams.set('wstoken', parsed.data.web_service_token);

    const probe = await fetch(probeUrl.toString()).catch(() => null);
    if (!probe || !probe.ok) {
      return sendError(
        c,
        apiError(ErrorCode.VALIDATION_ERROR, 'Could not reach Moodle site_info endpoint', 422),
      );
    }
    const info = (await probe.json()) as {
      sitename?: string;
      fullname?: string;
      userid?: number;
      exception?: string;
      message?: string;
    };
    if (info.exception) {
      return sendError(
        c,
        apiError(ErrorCode.VALIDATION_ERROR, info.message ?? 'Moodle token rejected', 422),
      );
    }

    const admin = createAdminClient();
    const { error } = await admin.from('source_connections').upsert(
      {
        user_id: user.userId,
        provider,
        connected: true,
        display_name: info.fullname ?? 'Moodle user',
        detail_label: info.sitename ?? cleanUrl,
        access_token: encryptSecret(parsed.data.web_service_token),
        metadata: { moodle_url: cleanUrl, moodle_user_id: info.userid ?? null },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' },
    );
    if (error) {
      return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'Failed to save connection', 500));
    }
    return c.json({ ok: true });
  }

  if (provider === 'obsidian') {
    const parsed = await parseJson(c, obsidianConnectSchema);
    if ('error' in parsed) return sendError(c, parsed.error);
    const charCount = parsed.data.content.length;

    const admin = createAdminClient();
    const { error } = await admin.from('source_connections').upsert(
      {
        user_id: user.userId,
        provider,
        connected: true,
        display_name: 'Obsidian Vault',
        detail_label: `${charCount.toLocaleString()} characters`,
        metadata: { vault_content: parsed.data.content },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' },
    );
    if (error) {
      return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'Failed to save vault', 500));
    }
    return c.json({ ok: true });
  }

  return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'Unhandled provider', 500));
});

authedRouter.delete('/:provider/disconnect', async (c) => {
  const user = getUser(c);
  const provider = c.req.param('provider');
  if (!VALID.has(provider as Provider)) {
    return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Unknown provider', 404));
  }
  const typedProvider = provider as Provider;
  const admin = createAdminClient();
  await admin
    .from('source_connections')
    .update({
      connected: false,
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.userId)
    .eq('provider', typedProvider);

  await admin
    .from('source_cache')
    .delete()
    .eq('user_id', user.userId)
    .eq('provider', typedProvider);

  return c.body(null, 204);
});

// ---- PUBLIC OAUTH CALLBACK (no auth — verified via signed state) ----
// Registered BEFORE the authed router is mounted so that authedRouter's
// `use('*', requireAuth)` middleware does not gate the public callback (which is
// hit by the provider's redirect with no credentials).

export const connectionsRouter = new Hono();

connectionsRouter.get('/:provider/callback', async (c) => {
  const provider = c.req.param('provider');

  if (provider !== 'google_drive' && provider !== 'notion') {
    return c.redirect(redirectToConnections('error', provider, 'unknown_provider').toString());
  }

  const errorParam = c.req.query('error');
  if (errorParam) {
    return c.redirect(redirectToConnections('error', provider, errorParam).toString());
  }
  const code = c.req.query('code');
  const state = c.req.query('state');
  if (!code || !state) {
    return c.redirect(redirectToConnections('error', provider, 'missing_params').toString());
  }
  const verified = verifyOAuthState(state, provider);
  if (!verified) {
    return c.redirect(redirectToConnections('error', provider, 'invalid_state').toString());
  }

  const base = apiPublicUrl();
  const redirectUri = `${base}/v1/connections/${provider}/callback`;
  const admin = createAdminClient();

  try {
    if (provider === 'google_drive') {
      const tokens = await exchangeGoogleCode(redirectUri, code);
      await admin.from('source_connections').upsert(
        {
          user_id: verified.userId,
          provider,
          connected: true,
          display_name: tokens.email,
          detail_label: tokens.email,
          access_token: encryptSecret(tokens.accessToken),
          refresh_token: encryptSecret(tokens.refreshToken),
          token_expires_at: tokens.expiryDate.toISOString(),
          metadata: {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,provider' },
      );
    } else {
      const result = await exchangeNotionCode(redirectUri, code);
      await admin.from('source_connections').upsert(
        {
          user_id: verified.userId,
          provider,
          connected: true,
          display_name: result.workspaceName,
          detail_label: result.workspaceName,
          access_token: encryptSecret(result.accessToken),
          metadata: { bot_id: result.botId, workspace_icon: result.workspaceIcon },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,provider' },
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'token_exchange_failed';
    return c.redirect(redirectToConnections('error', provider, message).toString());
  }

  return c.redirect(redirectToConnections('success', provider).toString());
});

// Mount the authenticated routes last so their `use('*', requireAuth)` middleware
// applies only to them and not to the public callback registered above.
connectionsRouter.route('/', authedRouter);
