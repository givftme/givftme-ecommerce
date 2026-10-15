"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { fieldLabel, smallInput } from "@/components/admin/AdminUi";
import { useAdminRequest } from "@/components/admin/useAdminRequest";
import { formatPrice } from "@/lib/utils";

export function PayoutActions({
  payoutId,
  status,
  amount,
  receiver,
  canUpdate,
}: {
  payoutId: string;
  status: "pending_ops_action" | "processing";
  amount: number;
  receiver: string;
  canUpdate: boolean;
}) {
  const { send, pending } = useAdminRequest();
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState({ bank_name: "", account_number: "", account_name: "", reference: "" });

  if (!canUpdate) return <span className="text-xs text-muted">View only</span>;

  const markProcessing = () => send(`/api/admin/pools/payouts/${payoutId}`, { method: "PATCH", body: { status: "processing" } }, "Marked processing.");

  const complete = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await send(`/api/admin/pools/payouts/${payoutId}`, { method: "PATCH", body: { status: "completed", ...details } }, `Payout to ${receiver} recorded.`);
    if (ok) setOpen(false);
  };

  const field = (key: keyof typeof details, label: string, props: Record<string, unknown> = {}) => (
    <div>
      <label htmlFor={`${payoutId}-${key}`} className={fieldLabel}>{label}</label>
      <input
        id={`${payoutId}-${key}`}
        required
        value={details[key]}
        onChange={(event) => setDetails((current) => ({ ...current, [key]: event.target.value }))}
        className={smallInput}
        {...props}
      />
    </div>
  );

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {status === "pending_ops_action" ? (
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => void markProcessing()}>Mark processing</Button>
      ) : null}
      <Button type="button" size="sm" disabled={pending} onClick={() => setOpen(true)}>Mark completed</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record the transfer</DialogTitle>
            <DialogDescription>{formatPrice(amount)} to {receiver}. Enter the details exactly as they appear on the bank transfer.</DialogDescription>
          </DialogHeader>
          <form onSubmit={complete} className="mt-5 space-y-3">
            {field("bank_name", "Bank name", { maxLength: 100, autoComplete: "off" })}
            {field("account_number", "Account number (10 digits)", { inputMode: "numeric", pattern: "\\d{10}", maxLength: 10, autoComplete: "off" })}
            {field("account_name", "Account name", { maxLength: 150, autoComplete: "off" })}
            {field("reference", "Transfer reference", { maxLength: 100, autoComplete: "off" })}
            <div className="flex flex-col-reverse gap-3 pt-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Mark completed"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
