"use client";

import { AlertTriangle, Camera, Clock3 } from "lucide-react";
import { useBizDash } from "@/components/business-dashboard/BizDashContext";
import { Card, EmptyState, ViewHeader } from "@/components/business-dashboard/BizUi";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { BusinessDelivery } from "@/lib/business-dashboard/types";
import { cn } from "@/lib/utils";

function formatWhen(delivery: BusinessDelivery) {
  if (!delivery.delivered_at) return "Scheduled";
  return new Date(delivery.delivered_at).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });
}

/** One delivery: photo (4:3) or a Scheduled placeholder, then who, what and when. */
export function BizProofTile({ delivery, compact = false }: { delivery: BusinessDelivery; compact?: boolean }) {
  const what = [delivery.occasion, delivery.gift_type].filter(Boolean).join(" · ");
  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative aspect-[4/3] bg-surface">
        {delivery.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- ops upload proof photos to arbitrary storage hosts
          <img
            src={delivery.photo_url}
            alt={`${delivery.gift_type || "Gift"} delivered to ${delivery.recipient_name}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted">
            {delivery.status === "delivered" ? <Camera aria-hidden="true" className="h-6 w-6" /> : <Clock3 aria-hidden="true" className="h-6 w-6" />}
            <span className="text-xs font-medium">{delivery.status === "delivered" ? "Photo coming" : "Scheduled"}</span>
          </div>
        )}
      </div>
      <div className={cn("flex flex-col gap-0.5", compact ? "p-3" : "p-4")}>
        <p className="truncate text-sm font-semibold text-ink">
          {delivery.recipient_name}
          {delivery.recipient_group ? <span className="font-normal text-muted"> · {delivery.recipient_group}</span> : null}
        </p>
        {what ? <p className="truncate text-xs text-muted">{what}</p> : null}
        <p className="text-xs text-muted">{formatWhen(delivery)}</p>
      </div>
    </li>
  );
}

/** Proof of delivery photos, plus exceptions that need a decision. */
export function BizProof() {
  const { deliveries, openBrief } = useBizDash();
  const exceptions = deliveries.filter((delivery) => delivery.status === "failed" || delivery.status === "rebooked");
  const grid = deliveries.filter((delivery) => delivery.status === "delivered" || delivery.status === "scheduled");

  return (
    <>
      <ViewHeader title="Deliveries" description="A photo for every gift delivered, and anything that needs you." />

      {exceptions.length ? (
        <section aria-labelledby="exceptions-heading" className="mb-6">
          <h2 id="exceptions-heading" className="mb-3 flex items-center gap-2 text-base font-bold text-ink">
            <AlertTriangle aria-hidden="true" className="h-4 w-4 text-amber-600" /> Exceptions
          </h2>
          <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(290px,1fr))]">
            {exceptions.map((delivery) => (
              <li key={delivery.id} className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber/30 dark:bg-amber/10">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{delivery.recipient_name}</p>
                    <p className="truncate text-xs text-muted">{[delivery.occasion, delivery.gift_type].filter(Boolean).join(" · ")}</p>
                  </div>
                  <Badge variant={delivery.status === "failed" ? "danger" : "warning"}>
                    {delivery.status === "failed" ? "Not delivered" : "Rebooked"}
                  </Badge>
                </div>
                {delivery.exception_note ? <p className="text-sm text-ink">{delivery.exception_note}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      openBrief({
                        occasion: delivery.occasion ?? undefined,
                        heads: 1,
                        notes: `Please rebook the ${delivery.gift_type || "gift"} for ${delivery.recipient_name}${delivery.recipient_group ? ` (${delivery.recipient_group})` : ""}.${delivery.exception_note ? ` Last note: ${delivery.exception_note}` : ""}`,
                      })
                    }
                  >
                    Ask us to rebook
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      openBrief({
                        occasion: delivery.occasion ?? undefined,
                        heads: 1,
                        notes: `Instead of the ${delivery.gift_type || "gift"} for ${delivery.recipient_name}, please send `,
                      })
                    }
                  >
                    Send something else
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {grid.length ? (
        <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
          {grid.map((delivery) => (
            <BizProofTile key={delivery.id} delivery={delivery} />
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState title="No deliveries yet">
            When a campaign is delivered, a photo of every gift appears here.
          </EmptyState>
        </Card>
      )}
    </>
  );
}
