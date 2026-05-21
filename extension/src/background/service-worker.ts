// All listeners MUST be registered synchronously at the top level of this file.
// No global state — service worker terminates after 30s idle and any module
// variables are lost. Use chrome.storage.local for persistence.

const REFRESH_CONNECTIONS_ALARM = 'refresh-connections';

chrome.runtime.onInstalled.addListener(() => {
  // Idempotent storage seed.
  chrome.storage.local.get(['api_base']).then((cur) => {
    if (!cur.api_base) {
      chrome.storage.local.set({ api_base: 'http://localhost:3000' });
    }
  });

  chrome.alarms.create(REFRESH_CONNECTIONS_ALARM, { periodInMinutes: 10 });
});

// External messages from the web app's /extension/auth-complete page.
chrome.runtime.onMessageExternal.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'SET_TOKEN' && typeof msg.token === 'string') {
    const updates: Record<string, unknown> = { session_token: msg.token };
    if (typeof msg.api_base === 'string') {
      updates.api_base = msg.api_base.replace(/\/+$/, '');
    }
    // Drop cached lists so the popup re-fetches with the new token.
    updates.courses_cache = null;
    updates.connections_cache = null;
    chrome.storage.local
      .set(updates)
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: String(err) }),
      );
    return true;
  }
  sendResponse({ ok: false, error: 'unknown_message' });
  return false;
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'GET_STORAGE' && typeof msg.key === 'string') {
    chrome.storage.local
      .get(msg.key)
      .then((v) => sendResponse({ value: v[msg.key] }))
      .catch((err) => sendResponse({ error: String(err) }));
    return true;
  }

  if (msg?.type === 'EXTRACT_CONTENT') {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (!tab?.id) {
          sendResponse({ error: 'no_active_tab' });
          return;
        }
        chrome.tabs
          .sendMessage(tab.id, { type: 'EXTRACT_CONTENT' })
          .then((r) => sendResponse(r))
          .catch((err) => sendResponse({ error: String(err) }));
      })
      .catch((err) => sendResponse({ error: String(err) }));
    return true;
  }

  return false;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== REFRESH_CONNECTIONS_ALARM) return;
  // Refresh connections cache so the popup stays current.
  chrome.storage.local.get(['api_base', 'session_token']).then(async (s) => {
    if (!s.session_token || !s.api_base) return;
    try {
      const res = await fetch(`${s.api_base}/api/v1/connections`, {
        headers: { Authorization: `Bearer ${s.session_token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      await chrome.storage.local.set({
        connections_cache: data,
        connections_cached_at: Date.now(),
      });
    } catch {
      // Swallow — popup will retry on open.
    }
  });
});
