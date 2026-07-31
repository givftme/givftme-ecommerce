import type { SupabaseClient } from "@supabase/supabase-js";
import { parseDateOnly } from "@/lib/occasion/date";
import {
  REMINDER_CHANNELS as channels,
  REMINDER_WINDOWS as windows,
  subDays,
} from "@/lib/reminders/constants";

export async function deleteUnsentInviteeReminders({
  supabase,
  userId,
  inviteId,
}: {
  supabase: SupabaseClient;
  userId: string;
  inviteId: string;
}) {
  const { error } = await supabase
    .from("reminders")
    .delete()
    .eq("user_id", userId)
    .eq("invite_id", inviteId)
    .eq("reminder_type", "invitee")
    .eq("sent", false);

  if (error) {
    throw new Error(error.message);
  }
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
  await deleteUnsentInviteeReminders({ supabase, userId, inviteId });

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
        days_before: days,
        sent: false,
      }))
    )
    .filter((reminder) => new Date(reminder.scheduled_at) > new Date());

  if (reminders.length === 0) {
    return;
  }

  const { error } = await supabase.from("reminders").insert(reminders);

  if (error) {
    throw new Error(error.message);
  }
}
