import { requireAdminApi } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { toCsv } from "@/lib/admin/csv";
import { getSegmentExport } from "@/lib/admin/data/growth";
import { MIN_AGGREGATE_SIZE } from "@/lib/admin/privacy";
import { findSegment, SEGMENT_EXPORT_HEADERS } from "@/lib/admin/segments";
import { jsonError } from "@/lib/api/response";

interface SegmentRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: SegmentRouteContext) {
  const { id } = await context.params;
  const segment = findSegment(id);
  if (!segment) return jsonError("Segment not found.", 404);

  const auth = await requireAdminApi("segments");
  if (!auth.ok) return auth.response;

  try {
    const result = await getSegmentExport(auth.service, segment.id);
    await logAdminAction(auth.service, auth.member.id, {
      action: "export_segment",
      targetType: "segment",
      targetId: segment.id,
      metadata: { members: result.total, suppressed: result.suppressed },
    });

    const csv = toCsv(SEGMENT_EXPORT_HEADERS, result.rows.map((row) => [
      row.user_id, row.name, row.email, row.phone, row.city, row.next_date,
    ]));
    const date = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="segment-${segment.id}-${date}.csv"`,
        "Cache-Control": "no-store",
        // Privacy rule 1: a segment under the minimum size exports headers only.
        "X-Segment-Members": String(result.total),
        "X-Segment-Suppressed": result.suppressed ? `fewer-than-${MIN_AGGREGATE_SIZE}` : "no",
      },
    });
  } catch (error) {
    console.error("Could not export segment.", error);
    return jsonError("Couldn't export this segment. Try again.", 500);
  }
}
