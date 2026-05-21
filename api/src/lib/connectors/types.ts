export interface CollectedItem {
  source_key: string;
  source_name: string;
  source_url?: string | null;
  content: string;
}

export interface ConnectorResult {
  items: CollectedItem[];
  error?: string;
}

export type Provider =
  | 'google_drive'
  | 'notion'
  | 'canvas'
  | 'moodle'
  | 'obsidian';

export function trimToCharLimit(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const half = Math.floor(limit / 2);
  return (
    text.slice(0, half) +
    '\n\n[…content trimmed…]\n\n' +
    text.slice(text.length - half)
  );
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
