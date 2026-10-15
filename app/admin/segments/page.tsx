import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/AdminUi";
import { SegmentCard } from "@/components/admin/SegmentCard";
import { requireAdminScreen } from "@/lib/admin/auth";
import { getSegmentCounts } from "@/lib/admin/data/growth";
import { MIN_AGGREGATE_SIZE } from "@/lib/admin/privacy";
import { SEGMENTS } from "@/lib/admin/segments";
import { createServiceClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Segments" };

export default async function SegmentsPage() {
  await requireAdminScreen("segments", { path: "/admin/segments" });
  const counts = await getSegmentCounts(createServiceClient());
  const refreshedAt = new Date().toISOString();

  return (
    <>
      <AdminPageHeader
        title="Segments & Exports"
        description={`Lifecycle segments, computed live when this page loads. Team members are never included, remembrance and sympathy dates never count, and exports need at least ${MIN_AGGREGATE_SIZE} people.`}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SEGMENTS.map((segment) => (
          <SegmentCard
            key={segment.id}
            id={segment.id}
            name={segment.name}
            definition={segment.definition}
            count={counts[segment.id]}
            refreshedAt={refreshedAt}
          />
        ))}
      </div>
    </>
  );
}
