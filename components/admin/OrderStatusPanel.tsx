"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { fieldLabel, selectClass, smallInput } from "@/components/admin/AdminUi";
import { useAdminRequest } from "@/components/admin/useAdminRequest";
import type { OrderStatus } from "@/lib/orders/types";

const LABELS: Partial<Record<OrderStatus, string>> = {
  under_review: "Under review",
  forwarded: "Forwarded to supplier",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export function OrderStatusPanel({
  orderId,
  nextStatuses,
  tracking,
}: {
  orderId: string;
  /** Only the valid next statuses, from the transition machine. */
  nextStatuses: OrderStatus[];
  tracking: { number: string | null; carrier: string | null; url: string | null };
}) {
  const { send, pending } = useAdminRequest();
  const [status, setStatus] = useState<OrderStatus | "">(nextStatuses[0] ?? "");
  const [trackingNumber, setTrackingNumber] = useState(tracking.number ?? "");
  const [carrier, setCarrier] = useState(tracking.carrier ?? "");
  const [trackingUrl, setTrackingUrl] = useState(tracking.url ?? "");
  const [notes, setNotes] = useState("");

  if (!nextStatuses.length) {
    return <p className="text-sm text-muted">This order is in a final state. There is nothing left to move it to.</p>;
  }

  const shipping = status === "shipped";
  const destructive = status === "cancelled" || status === "refunded";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!status) return;
    if (destructive && !window.confirm(`Mark this order ${LABELS[status]?.toLowerCase()}? The customer will be emailed.`)) return;
    const ok = await send(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      body: {
        status,
        tracking_number: shipping ? trackingNumber : null,
        carrier_name: shipping ? carrier : null,
        tracking_url: shipping ? trackingUrl : null,
        notes,
      },
    }, `Order moved to ${LABELS[status]?.toLowerCase()}.`);
    if (ok) setNotes("");
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="next-status" className={fieldLabel}>Move to</label>
        <select id="next-status" value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)} className={selectClass}>
          {nextStatuses.map((next) => <option key={next} value={next}>{LABELS[next] ?? next}</option>)}
        </select>
      </div>
      {shipping ? (
        <>
          <div>
            <label htmlFor="tracking-number" className={fieldLabel}>Tracking number</label>
            <input id="tracking-number" value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} maxLength={100} className={smallInput} />
          </div>
          <div>
            <label htmlFor="carrier" className={fieldLabel}>Carrier</label>
            <input id="carrier" value={carrier} onChange={(event) => setCarrier(event.target.value)} maxLength={100} placeholder="e.g. GIG Logistics" className={smallInput} />
          </div>
          <div>
            <label htmlFor="tracking-url" className={fieldLabel}>Tracking link</label>
            <input id="tracking-url" type="url" value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} placeholder="https://" className={smallInput} />
          </div>
        </>
      ) : null}
      <div>
        <label htmlFor="status-notes" className={fieldLabel}>Notes (kept in the status history)</label>
        <Textarea id="status-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} className="min-h-20" />
      </div>
      <Button type="submit" fullWidth disabled={pending || !status}>{pending ? "Updating…" : "Update status"}</Button>
      <p className="text-xs text-muted">Payment states are set only by Flutterwave. The customer gets an email for each change.</p>
    </form>
  );
}
