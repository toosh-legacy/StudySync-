import type { ConnectorResult, CollectedItem } from './types.js';
import { stripHtml, trimToCharLimit } from './types.js';

const PER_PAGE_LIMIT = 10_000;
const MAX_PAGES_TOTAL = 30;

async function canvasGet<T>(
  baseUrl: string,
  path: string,
  token: string,
): Promise<T | { __error: string; __status: number }> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return {
      __error: `Canvas ${path} returned ${res.status}`,
      __status: res.status,
    };
  }
  return (await res.json()) as T;
}

export async function fetchCanvasContent(
  baseUrl: string,
  token: string,
): Promise<ConnectorResult> {
  const courses = await canvasGet<
    Array<{ id: number; name: string; course_code?: string }>
  >(baseUrl, '/api/v1/courses?enrollment_state=active&per_page=20', token);
  if (!Array.isArray(courses)) {
    if (courses.__status === 401)
      return { items: [], error: 'Canvas token invalid' };
    if (courses.__status === 403)
      return {
        items: [],
        error: 'Canvas token does not have sufficient permissions',
      };
    return { items: [], error: courses.__error };
  }

  const items: CollectedItem[] = [];

  for (const course of courses) {
    if (items.length >= MAX_PAGES_TOTAL) break;
    const modules = await canvasGet<Array<{ id: number; name: string }>>(
      baseUrl,
      `/api/v1/courses/${course.id}/modules?per_page=20`,
      token,
    );
    if (!Array.isArray(modules)) continue;

    for (const mod of modules) {
      if (items.length >= MAX_PAGES_TOTAL) break;
      const moduleItems = await canvasGet<
        Array<{
          id: number;
          title: string;
          type: string;
          page_url?: string;
          html_url?: string;
        }>
      >(
        baseUrl,
        `/api/v1/courses/${course.id}/modules/${mod.id}/items?per_page=50`,
        token,
      );
      if (!Array.isArray(moduleItems)) continue;

      for (const mi of moduleItems) {
        if (items.length >= MAX_PAGES_TOTAL) break;
        if (mi.type !== 'Page' || !mi.page_url) continue;

        const page = await canvasGet<{
          body?: string;
          html_url?: string;
          title?: string;
        }>(
          baseUrl,
          `/api/v1/courses/${course.id}/pages/${encodeURIComponent(mi.page_url)}`,
          token,
        );
        if (!page || '__error' in page) continue;
        if (!page.body) continue;

        const text = stripHtml(page.body);
        if (!text) continue;
        items.push({
          source_key: `canvas_${course.id}_${mi.page_url}`,
          source_name: `${course.course_code ?? course.name} — ${mi.title}`,
          source_url: page.html_url ?? mi.html_url ?? null,
          content: trimToCharLimit(text, PER_PAGE_LIMIT),
        });
      }
    }
  }

  return { items };
}
