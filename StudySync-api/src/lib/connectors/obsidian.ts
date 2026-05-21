import type { ConnectorResult } from './types.js';
import { trimToCharLimit } from './types.js';

const HARD_LIMIT = 50_000;

export function fetchObsidianContent(
  vaultContent: unknown,
): ConnectorResult {
  if (typeof vaultContent !== 'string' || !vaultContent.trim()) {
    return { items: [], error: 'Obsidian vault content not found' };
  }
  return {
    items: [
      {
        source_key: 'obsidian_vault',
        source_name: 'Obsidian Vault',
        source_url: null,
        content: trimToCharLimit(vaultContent, HARD_LIMIT),
      },
    ],
  };
}
