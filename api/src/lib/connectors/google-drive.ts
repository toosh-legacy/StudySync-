import { google } from 'googleapis';
import type { ConnectorResult, CollectedItem } from './types.js';
import { trimToCharLimit } from './types.js';

const MAX_FILES = 20;
const PER_FILE_LIMIT = 20_000;

export async function fetchGoogleDriveContent(
  accessToken: string,
  refreshToken: string,
): Promise<ConnectorResult> {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
  );
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  const drive = google.drive({ version: 'v3', auth });

  let files;
  try {
    const list = await drive.files.list({
      q: "(mimeType='text/plain' or mimeType='application/vnd.google-apps.document') and trashed=false",
      pageSize: MAX_FILES,
      orderBy: 'modifiedTime desc',
      fields: 'files(id, name, mimeType, webViewLink, modifiedTime)',
    });
    files = list.data.files ?? [];
  } catch (err) {
    return {
      items: [],
      error: err instanceof Error ? err.message : 'Drive list failed',
    };
  }

  const items: CollectedItem[] = [];
  for (const file of files) {
    if (!file.id || !file.name) continue;
    try {
      let text = '';
      if (file.mimeType === 'application/vnd.google-apps.document') {
        const exp = await drive.files.export(
          { fileId: file.id, mimeType: 'text/plain' },
          { responseType: 'text' },
        );
        text = typeof exp.data === 'string' ? exp.data : String(exp.data ?? '');
      } else {
        const dl = await drive.files.get(
          { fileId: file.id, alt: 'media' },
          { responseType: 'text' },
        );
        text = typeof dl.data === 'string' ? dl.data : String(dl.data ?? '');
      }
      if (!text.trim()) continue;
      items.push({
        source_key: file.id,
        source_name: file.name,
        source_url: file.webViewLink ?? null,
        content: trimToCharLimit(text, PER_FILE_LIMIT),
      });
    } catch {
      continue;
    }
  }

  return { items };
}
