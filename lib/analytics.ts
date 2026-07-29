type AnalyticsProperties = Record<string, boolean | number | string | null | undefined>;

const ANALYTICS_ENDPOINT = "/api/analytics";

function logAnalyticsEvent(event: string, properties: AnalyticsProperties) {
  console.log("[analytics]", event, properties);
}

// In production, a server-side call (RSC, route handler) logs directly —
// the host's own log aggregation (e.g. Vercel function logs) is the
// transport. A client-side call routes through /api/analytics instead,
// since a browser console.log in production is only visible to that one
// visitor, not captured anywhere. Never throws — analytics must not break the UI.
export function trackEvent(event: string, properties: AnalyticsProperties = {}) {
  if (process.env.NODE_ENV !== "production") {
    logAnalyticsEvent(event, properties);
    return;
  }

  if (typeof window === "undefined") {
    logAnalyticsEvent(event, properties);
    return;
  }

  try {
    const payload = JSON.stringify({ event, properties });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        ANALYTICS_ENDPOINT,
        new Blob([payload], { type: "application/json" })
      );
      return;
    }

    void fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  } catch {
    // Analytics must never break the UI.
  }
}
