import { NextResponse } from "next/server";
import { isUuid, requireAdminApi } from "@/lib/admin/auth";
import { resolveReminderFailure } from "@/lib/admin/data/moderation";
import { jsonError } from "@/lib/api/response";

interface ReminderRouteContext {
  params: Promise<{ id: string }>;
}

// Resets a permanently failed reminder so the next /api/reminders run sends it.
export async function PATCH(_request: Request, context: ReminderRouteContext) {
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("Reminder not found.", 404);

  const auth = await requireAdminApi("reminders");
  if (!auth.ok) return auth.response;
  try {
    const result = await resolveReminderFailure(auth.service, auth.member.id, id, "retry");
    return result.ok ? NextResponse.json({ retried: true }) : jsonError(result.error, result.status);
  } catch (error) {
    console.error("Could not retry reminder.", error);
    return jsonError("Couldn't retry the reminder. Try again.", 500);
  }
}
