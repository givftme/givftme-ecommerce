import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { toDateOnly } from "@/lib/occasion/date";
import { createReactivationPromptIfNeeded } from "@/lib/occasion/server";
import { createServiceClient } from "@/lib/supabase/server";

interface ArchivedOccasionRow {
  id: string;
  user_id: string;
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return jsonError("Cron secret is not configured.", 500);
  }

  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${cronSecret}`) {
    return jsonError("Unauthorized.", 401);
  }

  const supabase = createServiceClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffDate = toDateOnly(cutoff);

  const { data, error } = await supabase
    .from("occasions")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("status", "active")
    .lt("occasion_date", cutoffDate)
    .select("id, user_id")
    .returns<ArchivedOccasionRow[]>();

  if (error) {
    return jsonError("Couldn't archive occasions.", 500);
  }

  for (const occasion of data || []) {
    await createReactivationPromptIfNeeded({
      supabase,
      userId: occasion.user_id,
      occasionId: occasion.id,
    });
  }

  // Unresolved prompts older than 30 days auto-dismiss — the items stay purchased,
  // this just stops nudging the user about a decision they've had a month to make.
  const promptCutoff = new Date();
  promptCutoff.setDate(promptCutoff.getDate() - 30);

  await supabase
    .from("occasion_prompts")
    .update({ resolved_at: new Date().toISOString() })
    .is("resolved_at", null)
    .lt("created_at", promptCutoff.toISOString());

  return NextResponse.json({ archived: data?.length || 0 });
}
