import type { SupabaseClient } from "@supabase/supabase-js";
import { recordEvent } from "@/lib/events/server";

export interface AdminActionInput {
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Writes the audit row (`admin_actions`) and its `admin_action` event.
 * Privacy rule 4: every admin page view and mutation goes through here.
 * The event carries no user_id, so team activity never counts as customer
 * activity in retention or segments.
 */
export async function logAdminAction(service: SupabaseClient, adminId: string, input: AdminActionInput) {
  const targetType = input.targetType ?? null;
  const targetId = input.targetId ?? null;
  try {
    const { error } = await service.from("admin_actions").insert({
      admin_id: adminId,
      action: input.action,
      target_type: targetType,
      target_id: targetId,
      metadata: input.metadata ?? {},
    });
    if (error) console.error(`Could not log admin action ${input.action}.`, error);
  } catch (error) {
    console.error(`Could not log admin action ${input.action}.`, error);
  }

  await recordEvent({
    event: "admin_action",
    props: { action: input.action, target_type: targetType, target_id: targetId, admin_id: adminId },
  }, service);
}
