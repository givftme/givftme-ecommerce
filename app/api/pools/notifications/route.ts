import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";
import { processPendingPoolCashoutNotifications } from "@/lib/pools/notifications";

export const maxDuration = 300;

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return jsonError("Cron secret is not configured.", 500);
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const result = await processPendingPoolCashoutNotifications();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Could not process pool cash-out email notifications.", error);
    return jsonError("Couldn't process pool notifications.", 500);
  }
}
