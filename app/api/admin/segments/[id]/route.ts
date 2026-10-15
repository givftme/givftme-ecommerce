import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";
import { getSegmentPreview } from "@/lib/admin/data/growth";
import { findSegment } from "@/lib/admin/segments";
import { jsonError } from "@/lib/api/response";

interface SegmentRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: SegmentRouteContext) {
  const { id } = await context.params;
  const segment = findSegment(id);
  if (!segment) return jsonError("Segment not found.", 404);

  const auth = await requireAdminApi("segments", { audit: { action: "preview_segment", targetType: "segment", targetId: id } });
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ segment, ...(await getSegmentPreview(auth.service, segment.id)) });
  } catch (error) {
    console.error("Could not load segment preview.", error);
    return jsonError("Couldn't load this segment. Try again.", 500);
  }
}
