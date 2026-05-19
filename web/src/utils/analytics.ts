import { api } from "../api/client";

const SESSION_KEY = "autovinfix:analyticsSession";

export function getAnalyticsSessionId() {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `sess-${Date.now()}`;
  }
}

export function trackEvent(eventName: string, payload: Record<string, unknown> = {}) {
  const sessionId = getAnalyticsSessionId();
  if (import.meta.env.DEV) {
    console.info("[AutoVinFix analytics]", eventName, payload);
  }
  api.trackEvent({ sessionId, eventName, payload }).catch(() => undefined);
}
