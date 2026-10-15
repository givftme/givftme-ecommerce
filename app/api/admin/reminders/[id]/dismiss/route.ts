import { NextResponse } from "next/server";
import { isUuid, requireAdminApi } from "@/lib/admin/auth";
import { resolveReminderFailure } from "@/lib/admin/data/moderation";
import { jsonError } from "@/lib/api/response";

interface ReminderRouteContext {
  params: Promise<{ id: string }>;
}

// Hides a permanently failed reminder from the queue without deleting it.
export async function PATCH(_request: Request, context: ReminderRouteContext) {
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("Reminder not found.", 404);

  const auth = await requireAdminApi("reminders");
  if (!auth.ok) return auth.response;
  try {
    const result = await resolveReminderFailure(auth.service, auth.member.id, id, "dismiss");
    return result.ok ? NextResponse.json({ dismissed: true }) : jsonError(result.error, result.status);
  } catch (error) {
    console.error("Could not dismiss reminder.", error);
    return jsonError("Couldn't dismiss the reminder. Try again.", 500);
  }
}
