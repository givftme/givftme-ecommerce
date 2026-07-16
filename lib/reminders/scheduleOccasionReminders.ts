import type { SupabaseClient } from "@supabase/supabase-js";
import { parseDateOnly } from "@/lib/occasion/date";

const windows = [14, 3] as const;
const channels = ["email", "push"] as const;

function subDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}

export async function scheduleOccasionReminders({
  supabase,
  userId,
  occasionDate,
}: {
  supabase: SupabaseClient;
  userId: string;
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
        reminder_type: "occasion_owner",
        channel,
        scheduled_at: subDays(date, days).toISOString(),
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
}: {
  supabase: SupabaseClient;
  userId: string;
}) {
  await supabase
    .from("reminders")
    .delete()
    .eq("user_id", userId)
    .eq("reminder_type", "occasion_owner")
    .eq("sent", false);
}
