type AnalyticsProperties = Record<string, boolean | number | string | null | undefined>;

export function trackEvent(event: string, properties: AnalyticsProperties = {}) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[analytics]", event, properties);
  }
}
