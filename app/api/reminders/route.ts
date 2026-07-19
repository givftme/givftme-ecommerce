import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { createServiceClient } from "@/lib/supabase/server";

interface DueReminder {
  id: string;
  channel: string;
  reminder_type: string;
}

async function handOffDueReminders(reminders: DueReminder[]) {
  if (reminders.length === 0) {
    return;
  }

  // Reminder email/push delivery is intentionally deferred to the Reminders
  // feature. The established handoff is the unsent reminders queue itself, so
  // keep sent=false until a real dispatcher succeeds and can mark rows sent.
  console.warn("Reminder delivery is not implemented; reminders remain queued.", {
    count: reminders.length,
  });
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return jsonError("Cron secret is not configured.", 500);
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return jsonError("Unauthorized.", 401);
  }

  const supabase = createServiceClient();
  const intentCutoff = new Date();
  intentCutoff.setHours(intentCutoff.getHours() - 24);

  const { error: intentError } = await supabase
    .from("wishlist_items")
    .update({ intent_flagged_by: null, intent_flagged_at: null })
    .eq("status", "available")
    .lt("intent_flagged_at", intentCutoff.toISOString())
    .not("intent_flagged_at", "is", null);

  if (intentError) {
    return jsonError("Couldn't expire intent flags.", 500);
  }

  const { data: dueReminders, error: reminderError } = await supabase
    .from("reminders")
    .select("id, channel, reminder_type")
    .eq("sent", false)
    .lte("scheduled_at", new Date().toISOString());

  if (reminderError) {
    return jsonError("Couldn't process reminders.", 500);
  }

  try {
    await handOffDueReminders((dueReminders || []) as DueReminder[]);
  } catch (error) {
    console.error("Reminder handoff failed.", error);
    return jsonError("Couldn't process reminders.", 500);
  }

  return NextResponse.json({
    processed: 0,
    deferred: dueReminders?.length || 0,
  });
}
