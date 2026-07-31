import type { SupabaseClient } from "@supabase/supabase-js";
import { parseDateOnly } from "@/lib/occasion/date";

const windows = [14, 3] as const;
const channels = ["email", "push"] as const;

function subDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}

export async function deleteUnsentImportantDateReminders({
  supabase,
  userId,
  importantDateId,
}: {
  supabase: SupabaseClient;
  userId: string;
  importantDateId: string;
}) {
  const { error } = await supabase
    .from("reminders")
    .delete()
    .eq("user_id", userId)
    .eq("important_date_id", importantDateId)
    .eq("reminder_type", "occasion_owner")
    .eq("sent", false);

  if (error) {
    throw new Error(error.message);
  }
}

export async function scheduleImportantDateReminders({
  supabase,
  userId,
  importantDateId,
  date: dateOnly,
}: {
  supabase: SupabaseClient;
  userId: string;
  importantDateId: string;
  date: string;
}) {
  const date = parseDateOnly(dateOnly);

  if (!date) {
    return;
  }

  const reminders = windows
    .flatMap((days) =>
      channels.map((channel) => ({
        user_id: userId,
        important_date_id: importantDateId,
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

export async function rescheduleImportantDateReminders({
  supabase,
  userId,
  importantDateId,
  date,
}: {
  supabase: SupabaseClient;
  userId: string;
  importantDateId: string;
  date: string;
}) {
  await deleteUnsentImportantDateReminders({ supabase, userId, importantDateId });

  try {
    await scheduleImportantDateReminders({ supabase, userId, importantDateId, date });
  } catch (error) {
    console.error("Important date reminder rescheduling failed.", error);
  }
}
