// Embedding-based retrieval. When the combined source content is large, we chunk
// it, embed the chunks, rank them by cosine similarity against a query derived
// from the course/format/user prompt, and keep only the most relevant chunks
// within a character budget — so the model sees the signal, not 300k chars of noise.
//
// Embeddings are cached by content hash in the embedding_cache table to avoid
// re-embedding identical chunks across requests.

import { createHash } from 'node:crypto';
import { getOpenAI } from './client.js';
import { createAdminClient } from '../supabase.js';

const EMBED_MODEL = 'text-embedding-3-small';

// Above this combined character count, retrieval kicks in.
export const RETRIEVAL_CHAR_THRESHOLD = 60_000;
// Target size of the reduced content handed to the generation model.
const TARGET_CHARS = 40_000;
const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** Split text into overlapping chunks on whitespace boundaries where possible. */
export function chunkText(
  text: string,
  size = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP,
): string[] {
  const clean = text.trim();
  if (clean.length <= size) return clean ? [clean] : [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      // Prefer to break at the last whitespace within the window.
      const ws = clean.lastIndexOf(' ', end);
      if (ws > start + size / 2) end = ws;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = end - overlap;
  }
  return chunks.filter(Boolean);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Embed texts, using the embedding_cache table to skip already-embedded content. */
async function embedTexts(texts: string[]): Promise<number[][]> {
  const admin = createAdminClient();
  const hashes = texts.map(sha256);
  const result: (number[] | null)[] = new Array(texts.length).fill(null);

  const { data: cached } = await admin
    .from('embedding_cache')
    .select('content_hash, embedding')
    .in('content_hash', hashes)
    .eq('model', EMBED_MODEL);

  const cacheMap = new Map<string, number[]>();
  for (const row of cached ?? []) {
    cacheMap.set(row.content_hash as string, row.embedding as unknown as number[]);
  }

  const misses: { index: number; text: string; hash: string }[] = [];
  texts.forEach((text, i) => {
    const hit = cacheMap.get(hashes[i]);
    if (hit) result[i] = hit;
    else misses.push({ index: i, text, hash: hashes[i] });
  });

  if (misses.length > 0) {
    const openai = getOpenAI();
    const response = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: misses.map((m) => m.text),
    });
    const rows = misses.map((m, j) => {
      const embedding = response.data[j].embedding;
      result[m.index] = embedding;
      return { content_hash: m.hash, model: EMBED_MODEL, embedding: embedding as number[] };
    });
    await admin.from('embedding_cache').upsert(rows, { onConflict: 'content_hash,model' });
  }

  return result.map((e) => e ?? []);
}

export interface RetrievalSource {
  provider: string;
  source_name: string;
  content: string;
}

export interface RetrievalInfo {
  applied: boolean;
  chunks_total: number;
  chunks_selected: number;
  chars_before: number;
  chars_after: number;
}

/**
 * Reduce a set of sources to the most query-relevant chunks within a char budget.
 * Returns the reduced sources (preserving provider/source_name grouping and order)
 * plus retrieval metadata.
 */
export async function retrieveRelevant(
  sources: RetrievalSource[],
  query: string,
  targetChars = TARGET_CHARS,
): Promise<{ sources: RetrievalSource[]; info: RetrievalInfo }> {
  const charsBefore = sources.reduce((n, s) => n + s.content.length, 0);

  // Build a flat list of chunks tagged with their origin + order.
  const chunks: { sourceIdx: number; order: number; text: string }[] = [];
  sources.forEach((s, sourceIdx) => {
    chunkText(s.content).forEach((text, order) => {
      chunks.push({ sourceIdx, order, text });
    });
  });

  if (chunks.length === 0) {
    return {
      sources,
      info: { applied: false, chunks_total: 0, chunks_selected: 0, chars_before: charsBefore, chars_after: charsBefore },
    };
  }

  const [queryEmbedding, ...chunkEmbeddings] = await embedTexts([
    query,
    ...chunks.map((c) => c.text),
  ]);

  const ranked = chunks
    .map((c, i) => ({ ...c, score: cosine(queryEmbedding, chunkEmbeddings[i]) }))
    .sort((a, b) => b.score - a.score);

  // Greedily select highest-scoring chunks until the char budget is reached.
  const selected: typeof ranked = [];
  let total = 0;
  for (const c of ranked) {
    if (total + c.text.length > targetChars && selected.length > 0) continue;
    selected.push(c);
    total += c.text.length;
    if (total >= targetChars) break;
  }

  // Reassemble per source, preserving original chunk order within each source.
  const bySource = new Map<number, { order: number; text: string }[]>();
  for (const c of selected) {
    const arr = bySource.get(c.sourceIdx) ?? [];
    arr.push({ order: c.order, text: c.text });
    bySource.set(c.sourceIdx, arr);
  }

  const reduced: RetrievalSource[] = [];
  sources.forEach((s, idx) => {
    const parts = bySource.get(idx);
    if (!parts || parts.length === 0) return;
    parts.sort((a, b) => a.order - b.order);
    reduced.push({
      provider: s.provider,
      source_name: s.source_name,
      content: parts.map((p) => p.text).join('\n\n[…]\n\n'),
    });
  });

  const charsAfter = reduced.reduce((n, s) => n + s.content.length, 0);
  return {
    sources: reduced.length > 0 ? reduced : sources,
    info: {
      applied: true,
      chunks_total: chunks.length,
      chunks_selected: selected.length,
      chars_before: charsBefore,
      chars_after: charsAfter,
    },
  };
}
