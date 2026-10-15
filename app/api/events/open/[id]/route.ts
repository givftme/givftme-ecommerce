import { isUuid } from "@/lib/admin/auth";
import { recordEvent } from "@/lib/events/server";
import { createServiceClient } from "@/lib/supabase/server";

// A transparent 1×1 GIF.
const PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));

interface OpenRouteContext {
  params: Promise<{ id: string }>;
}

function pixel() {
  return new Response(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  });
}

// Reminder email open pixel: records reminder_opened for a reminder that was
// actually sent. Always answers with the image, whatever happens, and never
// reveals whether the id exists. Mail privacy proxies may preload images, so
// opens are an upper bound.
export async function GET(_request: Request, context: OpenRouteContext) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return pixel();

    const service = createServiceClient();
    const { data: reminder } = await service
      .from("reminders")
      .select("id, user_id, channel, days_before, sent")
      .eq("id", id)
      .maybeSingle();
    if (reminder?.sent) {
      await recordEvent({
        event: "reminder_opened",
        userId: reminder.user_id,
        props: { channel: reminder.channel, days_before: reminder.days_before, message_id: reminder.id },
      }, service);
    }
  } catch (error) {
    console.error("Could not record reminder open.", error);
  }
  return pixel();
}
