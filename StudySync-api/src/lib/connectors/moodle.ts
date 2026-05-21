import type { ConnectorResult, CollectedItem } from './types.js';
import { stripHtml, trimToCharLimit } from './types.js';

const PER_PAGE_LIMIT = 10_000;
const MAX_PAGES_TOTAL = 25;

async function moodleCall<T>(
  baseUrl: string,
  token: string,
  wsfunction: string,
  extra: Record<string, string | number> = {},
): Promise<T | null> {
  const url = new URL(`${baseUrl}/webservice/rest/server.php`);
  url.searchParams.set('wsfunction', wsfunction);
  url.searchParams.set('moodlewsrestformat', 'json');
  url.searchParams.set('wstoken', token);
  for (const [k, v] of Object.entries(extra)) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const json = (await res.json()) as T & { exception?: string };
  if (json && typeof json === 'object' && 'exception' in json && json.exception) {
    return null;
  }
  return json;
}

interface MoodleSiteInfo {
  userid: number;
  sitename?: string;
}
interface MoodleCourse {
  id: number;
  fullname: string;
  shortname?: string;
}
interface MoodleContentFile {
  type: string;
  fileurl?: string;
  filename?: string;
  content?: string;
}
interface MoodleModule {
  id: number;
  modname: string;
  name: string;
  url?: string;
  contents?: MoodleContentFile[];
}
interface MoodleSection {
  modules?: MoodleModule[];
}

export async function fetchMoodleContent(
  baseUrl: string,
  token: string,
): Promise<ConnectorResult> {
  const info = await moodleCall<MoodleSiteInfo>(
    baseUrl,
    token,
    'core_webservice_get_site_info',
  );
  if (!info) return { items: [], error: 'Moodle token invalid' };

  const courses = await moodleCall<MoodleCourse[]>(
    baseUrl,
    token,
    'core_enrol_get_users_courses',
    { userid: info.userid },
  );
  if (!courses || !Array.isArray(courses)) {
    return { items: [], error: 'Could not list Moodle courses' };
  }

  const items: CollectedItem[] = [];

  for (const course of courses) {
    if (items.length >= MAX_PAGES_TOTAL) break;
    const sections = await moodleCall<MoodleSection[]>(
      baseUrl,
      token,
      'core_course_get_contents',
      { courseid: course.id },
    );
    if (!sections) continue;

    for (const section of sections) {
      if (items.length >= MAX_PAGES_TOTAL) break;
      for (const mod of section.modules ?? []) {
        if (items.length >= MAX_PAGES_TOTAL) break;
        if (mod.modname !== 'page') continue;

        const contentEntry = (mod.contents ?? []).find(
          (c) => c.type === 'content',
        );
        let text = '';
        if (contentEntry?.content) {
          text = stripHtml(contentEntry.content);
        } else if (contentEntry?.fileurl) {
          try {
            const url = new URL(contentEntry.fileurl);
            url.searchParams.set('token', token);
            const r = await fetch(url.toString());
            if (r.ok) {
              const raw = await r.text();
              text = stripHtml(raw);
            }
          } catch {
            continue;
          }
        }
        if (!text) continue;

        items.push({
          source_key: `moodle_${course.id}_${mod.id}`,
          source_name: `${course.shortname ?? course.fullname} — ${mod.name}`,
          source_url: mod.url ?? null,
          content: trimToCharLimit(text, PER_PAGE_LIMIT),
        });
      }
    }
  }

  return { items };
}
