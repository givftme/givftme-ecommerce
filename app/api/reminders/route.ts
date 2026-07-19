import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { createServiceClient } from "@/lib/supabase/server";

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

  const { data: reminders, error: reminderError } = await supabase
    .from("reminders")
    .update({ sent: true })
    .eq("sent", false)
    .lte("scheduled_at", new Date().toISOString())
    .select("id");

  if (reminderError) {
    return jsonError("Couldn't process reminders.", 500);
  }

  return NextResponse.json({ processed: reminders?.length || 0 });
}
