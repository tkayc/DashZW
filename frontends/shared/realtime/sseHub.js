/**
 * Single SSE connection per browser tab — shared across all hooks/components.
 * v15 used BroadcastChannel (instant); v16 uses server push over /api/events.
 */
import { resolveApiBaseUrl } from '../apiBaseUrl.js';

const listeners = new Set();
let es = null;
let subscriberCount = 0;

function ensureConnection() {
  if (es) return;
  const url = `${resolveApiBaseUrl()}/api/events`;
  es = new EventSource(url);
  es.onmessage = (ev) => {
    let payload = {};
    try {
      payload = JSON.parse(ev.data);
    } catch {
      payload = {};
    }
    listeners.forEach((fn) => {
      try {
        fn(payload);
      } catch {
        /* ignore listener errors */
      }
    });
  };
}

export function subscribeSse(listener) {
  listeners.add(listener);
  subscriberCount += 1;
  ensureConnection();
  return () => {
    listeners.delete(listener);
    subscriberCount -= 1;
    if (subscriberCount <= 0 && es) {
      es.close();
      es = null;
      subscriberCount = 0;
    }
  };
}
