import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { toDateOnly } from "@/lib/occasion/date";
import { createServiceClient } from "@/lib/supabase/server";

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
    .select("id");

  if (error) {
    return jsonError("Couldn't archive occasions.", 500);
  }

  return NextResponse.json({ archived: data?.length || 0 });
}
