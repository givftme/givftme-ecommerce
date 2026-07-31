import type { SupabaseClient } from "@supabase/supabase-js";
import { parseDateOnly } from "@/lib/occasion/date";
import {
  REMINDER_CHANNELS as channels,
  REMINDER_WINDOWS as windows,
  subDays,
} from "@/lib/reminders/constants";

export async function scheduleOccasionReminders({
  supabase,
  userId,
  occasionId,
  occasionDate,
}: {
  supabase: SupabaseClient;
  userId: string;
  occasionId: string;
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
        occasion_id: occasionId,
        reminder_type: "occasion_owner",
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

export async function deleteUnsentOccasionReminders({
  supabase,
  userId,
  occasionId,
}: {
  supabase: SupabaseClient;
  userId: string;
  occasionId: string;
}) {
  await supabase
    .from("reminders")
    .delete()
    .eq("user_id", userId)
    .eq("reminder_type", "occasion_owner")
    .eq("occasion_id", occasionId)
    .eq("sent", false);
}
