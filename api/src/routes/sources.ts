import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { createAdminClient } from '../lib/supabase.js';
import { apiError, ErrorCode } from '../lib/errors.js';
import { getUser, parseJson, sendError } from '../lib/http.js';
import { collectRequestSchema } from '../types/api.js';
import { refreshGoogleAccessToken } from '../lib/oauth/google.js';
import { fetchGoogleDriveContent } from '../lib/connectors/google-drive.js';
import { fetchNotionContent } from '../lib/connectors/notion.js';
import { fetchCanvasContent } from '../lib/connectors/canvas.js';
import { fetchMoodleContent } from '../lib/connectors/moodle.js';
import { fetchObsidianContent } from '../lib/connectors/obsidian.js';
import type { CollectedItem, Provider } from '../lib/connectors/types.js';

export const sourcesRouter = new Hono();
sourcesRouter.use('*', requireAuth);

const TOTAL_CHAR_LIMIT = 300_000;
const REFRESH_WINDOW_MS = 5 * 60 * 1000;

interface CollectedSource extends CollectedItem {
  provider: Provider | 'current_page';
  characters: number;
  from_cache: boolean;
}

interface SkippedSource {
  provider: string;
  reason: string;
}

function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex');
}

sourcesRouter.post('/collect', async (c) => {
  const user = getUser(c);
  const parsed = await parseJson(c, collectRequestSchema);
  if ('error' in parsed) return sendError(c, parsed.error);

  const { course_id, providers, current_page_content, current_page_url, current_page_title } =
    parsed.data;
  const admin = createAdminClient();

  const { data: course } = await admin
    .from('courses')
    .select('id')
    .eq('id', course_id)
    .eq('user_id', user.userId)
    .maybeSingle();
  if (!course) return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Course not found', 404));

  const collected: CollectedSource[] = [];
  const skipped: SkippedSource[] = [];

  for (const provider of providers) {
    const { data: conn } = await admin
      .from('source_connections')
      .select('connected, access_token, refresh_token, token_expires_at, metadata')
      .eq('user_id', user.userId)
      .eq('provider', provider)
      .maybeSingle();
    if (!conn || !conn.connected) {
      skipped.push({ provider, reason: 'Provider not connected' });
      continue;
    }

    let accessToken = conn.access_token ?? '';
    if (provider === 'google_drive' && conn.refresh_token) {
      const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
      if (expiresAt - Date.now() < REFRESH_WINDOW_MS) {
        try {
          const refreshed = await refreshGoogleAccessToken(conn.refresh_token);
          accessToken = refreshed.accessToken;
          await admin
            .from('source_connections')
            .update({
              access_token: refreshed.accessToken,
              token_expires_at: refreshed.expiryDate.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', user.userId)
            .eq('provider', provider);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'unknown';
          if (msg.toLowerCase().includes('invalid_grant')) {
            await admin
              .from('source_connections')
              .update({ connected: false, updated_at: new Date().toISOString() })
              .eq('user_id', user.userId)
              .eq('provider', provider);
            skipped.push({
              provider,
              reason: 'Token expired — please reconnect Google Drive in the dashboard.',
            });
            continue;
          }
          skipped.push({ provider, reason: `Token refresh failed: ${msg}` });
          continue;
        }
      }
    }

    let result;
    try {
      if (provider === 'google_drive') {
        result = await fetchGoogleDriveContent(accessToken, conn.refresh_token ?? '');
      } else if (provider === 'notion') {
        result = await fetchNotionContent(accessToken);
      } else if (provider === 'canvas') {
        const meta = (conn.metadata ?? {}) as { canvas_url?: string };
        if (!meta.canvas_url) {
          skipped.push({ provider, reason: 'Canvas URL missing' });
          continue;
        }
        result = await fetchCanvasContent(meta.canvas_url, accessToken);
      } else if (provider === 'moodle') {
        const meta = (conn.metadata ?? {}) as { moodle_url?: string };
        if (!meta.moodle_url) {
          skipped.push({ provider, reason: 'Moodle URL missing' });
          continue;
        }
        result = await fetchMoodleContent(meta.moodle_url, accessToken);
      } else if (provider === 'obsidian') {
        const meta = (conn.metadata ?? {}) as { vault_content?: string };
        result = fetchObsidianContent(meta.vault_content);
      } else {
        skipped.push({ provider, reason: 'Unknown provider' });
        continue;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      if (provider === 'notion' && msg.includes('401')) {
        await admin
          .from('source_connections')
          .update({ connected: false, updated_at: new Date().toISOString() })
          .eq('user_id', user.userId)
          .eq('provider', provider);
        skipped.push({ provider, reason: 'Notion access revoked — please reconnect.' });
      } else {
        skipped.push({ provider, reason: msg });
      }
      continue;
    }

    if (result.error && result.items.length === 0) {
      skipped.push({ provider, reason: result.error });
      continue;
    }

    for (const item of result.items) {
      const hash = sha256(item.content);
      await admin.from('source_cache').upsert(
        {
          user_id: user.userId,
          provider,
          source_key: item.source_key,
          content_hash: hash,
          content: item.content,
          source_name: item.source_name,
          source_url: item.source_url ?? null,
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: 'user_id,provider,source_key' },
      );

      collected.push({
        provider,
        source_key: item.source_key,
        source_name: item.source_name,
        source_url: item.source_url ?? null,
        content: item.content,
        characters: item.content.length,
        from_cache: false,
      });
    }

    await admin
      .from('source_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', user.userId)
      .eq('provider', provider);
  }

  if (current_page_content && current_page_content.trim().length > 0) {
    collected.push({
      provider: 'current_page',
      source_key: 'current_page',
      source_name: current_page_title ?? 'Current page',
      source_url: current_page_url ?? null,
      content: current_page_content,
      characters: current_page_content.length,
      from_cache: false,
    });
  }

  if (collected.length === 0) {
    return sendError(
      c,
      apiError(ErrorCode.NO_CONTENT, 'No source content could be collected.', 422, { skipped }),
    );
  }

  let totalChars = collected.reduce((sum, x) => sum + x.characters, 0);
  let warning: string | undefined;
  if (totalChars > TOTAL_CHAR_LIMIT) {
    const ratio = TOTAL_CHAR_LIMIT / totalChars;
    for (const x of collected) {
      const target = Math.floor(x.characters * ratio);
      if (x.content.length > target) {
        x.content = x.content.slice(0, target);
        x.characters = x.content.length;
      }
    }
    totalChars = collected.reduce((sum, x) => sum + x.characters, 0);
    warning = `Total content exceeded ${TOTAL_CHAR_LIMIT} chars; sources trimmed proportionally.`;
  }

  return c.json({
    collected,
    skipped,
    total_characters: totalChars,
    ...(warning ? { warning } : {}),
  });
});
