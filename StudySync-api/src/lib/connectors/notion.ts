import { Client } from '@notionhq/client';
import type { ConnectorResult, CollectedItem } from './types.js';
import { trimToCharLimit } from './types.js';

const NOTION_VERSION = '2025-09-03';
const MAX_PAGES = 20;
const PER_PAGE_LIMIT = 15_000;
const BLOCK_HARD_LIMIT = 500;

type RichText = { plain_text?: string };
type AnyBlock = Record<string, unknown> & {
  id: string;
  type: string;
  has_children?: boolean;
};

function extractRichText(blockBody: unknown): string {
  if (
    blockBody &&
    typeof blockBody === 'object' &&
    Array.isArray((blockBody as { rich_text?: RichText[] }).rich_text)
  ) {
    return (blockBody as { rich_text: RichText[] }).rich_text
      .map((rt) => rt.plain_text ?? '')
      .join('');
  }
  return '';
}

function blockToText(block: AnyBlock): string {
  const t = block.type;
  if (t === 'divider' || t === 'image' || t === 'video' || t === 'file' || t === 'embed') {
    return '';
  }
  const body = (block as Record<string, unknown>)[t];
  const txt = extractRichText(body);
  if (!txt) return '';
  if (t === 'heading_1') return `# ${txt}`;
  if (t === 'heading_2') return `## ${txt}`;
  if (t === 'heading_3') return `### ${txt}`;
  if (t === 'bulleted_list_item' || t === 'numbered_list_item') return `- ${txt}`;
  if (t === 'quote') return `> ${txt}`;
  return txt;
}

async function fetchAllBlocks(
  notion: Client,
  blockId: string,
  budget: { remaining: number },
): Promise<AnyBlock[]> {
  const out: AnyBlock[] = [];
  let cursor: string | undefined = undefined;
  while (budget.remaining > 0) {
    const res = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: Math.min(100, budget.remaining),
    });
    const blocks = res.results as AnyBlock[];
    out.push(...blocks);
    budget.remaining -= blocks.length;
    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor;
  }
  return out;
}

function getPageTitle(page: unknown): string {
  if (!page || typeof page !== 'object') return 'Untitled';
  const props = (page as { properties?: Record<string, unknown> }).properties;
  if (!props) return 'Untitled';
  for (const key of Object.keys(props)) {
    const prop = props[key] as { type?: string; title?: RichText[] };
    if (prop?.type === 'title' && Array.isArray(prop.title)) {
      const txt = prop.title.map((t) => t.plain_text ?? '').join('').trim();
      if (txt) return txt;
    }
  }
  return 'Untitled';
}

export async function fetchNotionContent(
  accessToken: string,
): Promise<ConnectorResult> {
  const notion = new Client({
    auth: accessToken,
    notionVersion: NOTION_VERSION,
  });

  let pages: unknown[] = [];
  try {
    const res = await notion.search({
      filter: { property: 'object', value: 'page' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: MAX_PAGES,
    });
    pages = res.results;
  } catch (err) {
    return {
      items: [],
      error: err instanceof Error ? err.message : 'Notion search failed',
    };
  }

  const items: CollectedItem[] = [];
  for (const page of pages) {
    const p = page as { id?: string; url?: string };
    if (!p.id) continue;
    try {
      const budget = { remaining: BLOCK_HARD_LIMIT };
      const blocks = await fetchAllBlocks(notion, p.id, budget);
      const text = blocks
        .map(blockToText)
        .filter(Boolean)
        .join('\n');
      if (!text.trim()) continue;
      const title = getPageTitle(page);
      items.push({
        source_key: p.id,
        source_name: title,
        source_url:
          p.url ?? `https://notion.so/${p.id.replace(/-/g, '')}`,
        content: trimToCharLimit(text, PER_PAGE_LIMIT),
      });
    } catch {
      continue;
    }
  }

  return { items };
}
