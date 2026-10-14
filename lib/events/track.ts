import type { ClientEventName } from "@/lib/events/names";

/**
 * Reports a browser-side event to the event log. Fire-and-forget: it never
 * throws and never blocks the user. Only events listed in CLIENT_EVENTS are
 * accepted; the rest are recorded server-side where they happen.
 */
export async function track(event: ClientEventName, props: Record<string, unknown> = {}) {
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, props }),
      keepalive: true,
    });
  } catch {} // fire-and-forget, never block the user
}
