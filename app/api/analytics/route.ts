import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/api/response";

const analyticsEventSchema = z.object({
  event: z.string().min(1),
  properties: z
    .record(z.string(), z.union([z.boolean(), z.number(), z.string(), z.null()]))
    .optional(),
});

// Receives client-side trackEvent() beacons so they land in the same server
// log aggregation as server-side calls, rather than only the visitor's own
// browser console. No auth — this is low-stakes telemetry, not user data.
export async function POST(request: Request) {
  const body = await readJson(request);
  const parsed = analyticsEventSchema.safeParse(body);

  if (parsed.success) {
    console.log("[analytics]", parsed.data.event, parsed.data.properties || {});
  }

  return new NextResponse(null, { status: 204 });
}
