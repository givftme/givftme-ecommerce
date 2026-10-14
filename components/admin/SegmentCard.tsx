"use client";

import { useState } from "react";
import { Download, Eye, Send } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { formatAdminDate, formatAdminDateTime } from "@/lib/admin/format";
import { MIN_AGGREGATE_SIZE } from "@/lib/admin/privacy";
import type { SegmentMember } from "@/lib/admin/segments";
import { cn } from "@/lib/utils";

export function SegmentCard({
  id,
  name,
  definition,
  count,
  refreshedAt,
  showPreview = true,
}: {
  id: string;
  name: string;
  definition: string;
  count: number;
  refreshedAt: string;
  showPreview?: boolean;
}) {
  const [rows, setRows] = useState<SegmentMember[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exportable = count >= MIN_AGGREGATE_SIZE;

  const preview = async () => {
    if (rows) {
      setRows(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/segments/${id}`);
      const payload = (await response.json()) as { rows?: SegmentMember[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Couldn't load the preview.");
      setRows(payload.rows ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't load the preview.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-line bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{name}</h3>
        <span className="shrink-0 text-2xl font-bold tabular-nums text-ink">{count.toLocaleString("en-NG")}</span>
      </div>
      <p className="mt-1 flex-1 text-xs text-muted">{definition}</p>
      <p className="mt-2 text-[11px] text-muted">Computed {formatAdminDateTime(refreshedAt)}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {showPreview ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => void preview()} disabled={loading || count === 0}>
            <Eye aria-hidden="true" className="h-4 w-4" /> {rows ? "Hide" : loading ? "Loading…" : "Preview"}
          </Button>
        ) : null}
        {exportable ? (
          <a href={`/api/admin/segments/${id}/export`} className={cn(buttonVariants({ size: "sm" }))}>
            <Download aria-hidden="true" className="h-4 w-4" /> Export CSV
          </a>
        ) : (
          <span className={cn(buttonVariants({ size: "sm" }), "pointer-events-none opacity-50")} aria-disabled="true" title={`Exports need at least ${MIN_AGGREGATE_SIZE} people`}>
            <Download aria-hidden="true" className="h-4 w-4" /> Export CSV
          </span>
        )}
        {showPreview ? (
          <span className={cn(buttonVariants({ size: "sm", variant: "text" }), "pointer-events-none opacity-50")} aria-disabled="true" title="Campaign messaging isn't available yet">
            <Send aria-hidden="true" className="h-4 w-4" /> Message
          </span>
        ) : null}
      </div>
      {!exportable ? <p className="mt-2 text-[11px] text-muted">Exports open at {MIN_AGGREGATE_SIZE} people, so no file describes a small group.</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
      {rows ? (
        rows.length === 0 ? <p className="mt-3 text-sm text-muted">Nobody in this segment.</p> : (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line text-xs">
            {rows.map((row) => (
              <li key={row.user_id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                <a href={`/admin/people/${row.user_id}`} className="font-medium text-brand hover:underline">{row.name || "Unnamed"}</a>
                <span className="text-muted">{[row.city, row.next_date ? `next ${formatAdminDate(row.next_date)}` : null].filter(Boolean).join(" · ") || "—"}</span>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </article>
  );
}
