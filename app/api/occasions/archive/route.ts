import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { toDateOnly } from "@/lib/occasion/date";
import { createReactivationPromptIfNeeded } from "@/lib/occasion/server";
import { daysBetween } from "@/lib/events/context";
import { recordEvent } from "@/lib/events/server";
import { createServiceClient } from "@/lib/supabase/server";

interface ArchivedOccasionRow {
  id: string;
  user_id: string;
  occasion_type: string | null;
  occasion_date: string;
}

// date_missed: an occasion archived with nothing on its wishlist gifted.
async function recordMissedOccasions(
  supabase: ReturnType<typeof createServiceClient>,
  occasions: ArchivedOccasionRow[],
) {
  for (const occasion of occasions) {
    try {
      const { data: lists } = await supabase
        .from("wishlists").select("id").eq("occasion_id", occasion.id);
      const listIds = (lists || []).map((list) => list.id);
      const { count } = listIds.length
        ? await supabase.from("wishlist_items").select("id", { count: "exact", head: true })
            .in("wishlist_id", listIds).eq("status", "purchased")
        : { count: 0 };
      if ((count ?? 0) > 0) continue;
      await recordEvent({
        event: "date_missed",
        userId: occasion.user_id,
        props: {
          occasion_id: occasion.id,
          occasion: occasion.occasion_type,
          days_late: daysBetween(new Date(`${occasion.occasion_date}T12:00:00+01:00`), new Date()),
        },
      }, supabase);
    } catch (error) {
      console.error("Could not record date_missed event.", error);
    }
  }
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
    .select("id, user_id, occasion_type, occasion_date")
    .returns<ArchivedOccasionRow[]>();

  if (error) {
    return jsonError("Couldn't archive occasions.", 500);
  }

  await Promise.all(
    (data || []).map((occasion) =>
      createReactivationPromptIfNeeded({
        supabase,
        userId: occasion.user_id,
        occasionId: occasion.id,
      }),
    ),
  );

  await recordMissedOccasions(supabase, data || []);

  // Unresolved prompts older than 30 days auto-dismiss — the items stay purchased,
  // this just stops nudging the user about a decision they've had a month to make.
  const promptCutoff = new Date();
  promptCutoff.setDate(promptCutoff.getDate() - 30);

  const { error: dismissError } = await supabase
    .from("occasion_prompts")
    .update({ resolved_at: new Date().toISOString() })
    .is("resolved_at", null)
    .lt("created_at", promptCutoff.toISOString());

      if (dismissError) {
        console.error("Stale reactivation prompt auto-dismiss failed.", dismissError);
      }

  return NextResponse.json({ archived: data?.length || 0 });
}
