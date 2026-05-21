// Content script — extracts page text on demand.

const MAX_CHARS = 40_000;

function detectPageType(url: string): string {
  if (url.includes('canvas')) return 'canvas';
  if (url.includes('moodle')) return 'moodle';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (document.querySelector('article')) return 'article';
  return 'generic';
}

function extractContent(): {
  title: string;
  url: string;
  content: string;
  page_type: string;
  character_count: number;
} {
  const clone = document.cloneNode(true) as Document;
  for (const sel of ['script', 'style', 'nav', 'footer', 'aside']) {
    clone.querySelectorAll(sel).forEach((el) => el.remove());
  }

  const main =
    clone.querySelector('main') ??
    clone.querySelector('article') ??
    clone.body;
  let text = (main?.textContent ?? '').trim().replace(/\s+/g, ' ');
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS);
  }

  return {
    title: document.title,
    url: window.location.href,
    content: text,
    page_type: detectPageType(window.location.href),
    character_count: text.length,
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'EXTRACT_CONTENT') {
    try {
      sendResponse(extractContent());
    } catch (err) {
      sendResponse({ error: err instanceof Error ? err.message : 'extract_failed' });
    }
    // Synchronous response; no need to return true.
  }
});
