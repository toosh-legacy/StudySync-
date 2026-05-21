import { useState } from 'react';
import {
  collectSources,
  generate,
  type GenerateResponse,
} from '../lib/api';
import type { ConnectionStatus } from '../lib/storage';

export type Status =
  | 'idle'
  | 'extracting'
  | 'collecting'
  | 'generating'
  | 'done'
  | 'error';

interface ExtractedPage {
  title: string;
  url: string;
  content: string;
  page_type: string;
  character_count: number;
}

async function extractCurrentPage(): Promise<ExtractedPage | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  try {
    const result = (await chrome.tabs.sendMessage(tab.id, {
      type: 'EXTRACT_CONTENT',
    })) as ExtractedPage | undefined;
    return result ?? null;
  } catch {
    return null;
  }
}

export function useGenerate() {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  const run = async (params: {
    courseId: string;
    providers: ConnectionStatus['provider'][];
    format: string;
    depth: string;
    includePage: boolean;
  }) => {
    setErrorMessage(null);
    setResult(null);
    try {
      let page: ExtractedPage | null = null;
      if (params.includePage) {
        setStatus('extracting');
        page = await extractCurrentPage();
      }

      setStatus('collecting');
      const collect = await collectSources({
        course_id: params.courseId,
        providers: params.providers,
        current_page_content: page?.content,
        current_page_url: page?.url,
        current_page_title: page?.title,
      });

      if (collect.collected.length === 0) {
        setStatus('error');
        setErrorMessage('No source content could be collected.');
        return;
      }

      setStatus('generating');
      const gen = await generate({
        course_id: params.courseId,
        output_format: params.format,
        depth: params.depth,
        sources: collect.collected.map((c) => ({
          provider: c.provider,
          source_name: c.source_name,
          source_url: c.source_url,
          content: c.content,
          characters: c.characters,
        })),
      });

      setResult(gen);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Generation failed');
    }
  };

  const reset = () => {
    setStatus('idle');
    setErrorMessage(null);
    setResult(null);
  };

  return { status, errorMessage, result, run, reset };
}
