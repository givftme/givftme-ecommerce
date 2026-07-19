import type { SupabaseClient } from "@supabase/supabase-js";
import { parseDateOnly } from "@/lib/occasion/date";

const windows = [14, 3] as const;
const channels = ["email", "push"] as const;

function subDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}

export async function scheduleInviteeReminders({
  supabase,
  userId,
  inviteId,
  occasionDate,
}: {
  supabase: SupabaseClient;
  userId: string;
  inviteId: string;
  occasionDate: string;
}) {
  const date = parseDateOnly(occasionDate);

  if (!date) {
    return;
  }

  const reminders = windows
    .flatMap((days) =>
      channels.map((channel) => ({
        user_id: userId,
        invite_id: inviteId,
        reminder_type: "invitee",
        channel,
        scheduled_at: subDays(date, days).toISOString(),
        sent: false,
      }))
    )
    .filter((reminder) => new Date(reminder.scheduled_at) > new Date());

  if (reminders.length === 0) {
    return;
  }

  const { error: deleteError } = await supabase
    .from("reminders")
    .delete()
    .eq("user_id", userId)
    .eq("invite_id", inviteId)
    .eq("reminder_type", "invitee")
    .eq("sent", false);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const { error } = await supabase.from("reminders").insert(reminders);

  if (error) {
    throw new Error(error.message);
  }
}
