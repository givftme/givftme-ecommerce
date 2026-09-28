"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { POLICY_LABELS, type PolicyPage, type PricingPolicy } from "@/lib/pricing/types";
import type { RateProposal } from "@/lib/pricing/validation";

interface Preview {
  calculation: Record<string, string | number | null>;
  preview_token: string;
  expires_at: string;
}

const ERROR_COPY: Record<string, string> = {
  invalid_proposal: "Check the rate and sample amounts. Physical source costs allow two decimal places; other amounts use whole Naira.",
  invalid_calculation: "This calculation exceeds the supported amount. Check your sample values.",
  pricing_revision_conflict: "Another rate was published. Your draft is saved here. Review the current rate and preview again.",
  preview_expired: "This preview has expired. Preview the rate again before publishing.",
  preview_changed: "The inputs changed. Preview again before publishing.",
  preview_consumed: "This preview was already used. Refresh the current rate and preview again.",
  pricing_preview_unconfigured: "Pricing previews are not configured. Ask your administrator to configure the preview signing secret.",
  pricing_storage_unavailable: "Pricing records are unavailable. Check the database setup, then retry.",
};

async function post(path: string, body: unknown, requestKey: string) {
  const response = await fetch(path, { method: "POST", headers: {
    "Content-Type": "application/json", "Idempotency-Key": requestKey,
  }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed. Please retry.");
  return payload;
}

function SampleBreakdown({ calculation }: { calculation: Preview["calculation"] }) {
  const fields = [
    ["gift_price_ngn", "Gift estimate"], ["confirmed_raised_ngn", "Verified funds after refunds and reversals"],
    ["recipient_ngn", "Recipient receives"], ["cash_fee_ngn", "Platform fee"],
    ["deduction_ngn", "Payout deduction"], ["delivery_ngn", "Delivery"], ["total_ngn", "Total"],
  ];
  return <dl className="space-y-2 text-sm">{fields.filter(([key]) => key in calculation).map(([key, label]) => (
    <div key={key} className="flex flex-wrap justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd>{calculation[key] === null ? "Awaiting confirmation" : <PriceDisplay price={Number(calculation[key])} size="sm" />}</dd>
    </div>
  ))}</dl>;
}

function PolicyForm({ policy, refresh }: { policy: PricingPolicy; refresh: () => Promise<void> }) {
  const [percentage, setPercentage] = useState("");
  const [amount, setAmount] = useState("10000");
  const [delivery, setDelivery] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [proposal, setProposal] = useState<RateProposal | null>(null);
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const physical = policy.key === "linked" || policy.key === "manual_sourced";
  const id = "pricing-" + policy.key;

  function edit(setter: (value: string) => void, value: string) {
    setter(value); setPreview(null); setProposal(null); setRequestKey(null); setMessage("");
  }

  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage(""); setFailed(false);
    try { await action(); }
    catch (error) {
      const code = error instanceof Error ? error.message : "";
      setFailed(true);
      setMessage(ERROR_COPY[code] || "The request could not be confirmed. Retry with the same reviewed inputs.");
      if (["pricing_revision_conflict", "preview_expired", "preview_changed", "preview_consumed"].includes(code)) {
        setPreview(null); setProposal(null); setRequestKey(null);
        await refresh().catch(() => {});
      }
    } finally { setBusy(false); }
  }

  async function review() {
    if (!/^(0|[1-9]\d{0,2})(\.\d{1,2})?$/.test(percentage)) {
      setFailed(true); setMessage("Enter a percentage with up to two decimal places."); return;
    }
    const [whole, fraction = ""] = percentage.split(".");
    const next: RateProposal = { policy_key: policy.key, rate_bps: Number(whole) * 100 + Number(fraction.padEnd(2, "0")),
      expected_revision: policy.revision, reason: reason.trim(), sample_amount_ngn: amount,
      sample_delivery_ngn: physical && delivery !== "" ? delivery : null };
    setPreview(null); setProposal(null); setRequestKey(null);
    await run(async () => {
      const result = await post("/api/admin/pricing/preview", { purpose: "rate_publish", proposal: next }, crypto.randomUUID());
      setPreview(result); setProposal(next); setRequestKey(crypto.randomUUID());
    });
  }

  async function publish() {
    if (!preview || !proposal || !requestKey) return;
    await run(async () => {
      await post("/api/admin/pricing/policies/" + policy.key + "/publish", { proposal, preview_token: preview.preview_token }, requestKey);
      setPreview(null); setProposal(null); setRequestKey(null);
      setMessage("Rate published. New estimates use this rate; earlier commitments keep their agreed amounts.");
      await refresh().catch(() => setMessage("Rate published. Refresh the page to load its history."));
    });
  }

  return (
    <section aria-labelledby={id + "-title"} className="rounded-2xl border border-line bg-white p-5 md:p-6">
      <div className="mb-5 space-y-2">
        <h2 id={id + "-title"} className="text-lg font-semibold text-ink">{POLICY_LABELS[policy.key]}</h2>
        <p className="text-sm text-muted">{policy.active_version
          ? "Current rate: " + policy.active_version.rate_bps / 100 + "% · Version " + policy.active_version.version
          : "No rate published. Pricing is unavailable until you publish a rate."}</p>
        <p className="text-sm text-muted">{physical ? "Markup applies to the item cost. Delivery is confirmed separately."
          : policy.key === "manual_cash" ? "The fee is added to the recipient’s desired amount." : "The deduction replaces the original fee and uses verified funds after refunds and reversals."}</p>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); void review(); }}>
        <fieldset disabled={busy} className="space-y-4">
          <legend className="sr-only">Change {POLICY_LABELS[policy.key].toLowerCase()} rate</legend>
          <div className="space-y-2">
            <label htmlFor={id + "-rate"} className="text-sm font-medium">New percentage</label>
            <Input id={id + "-rate"} inputMode="decimal" required value={percentage} onChange={(e) => edit(setPercentage, e.target.value)} placeholder="Enter a rate, including 0" aria-describedby={id + "-rate-help"} />
            <p id={id + "-rate-help"} className="text-xs text-muted">{policy.key === "partial_cash_payout" ? "0 to 99.99 percent." : "0 to 500 percent."} A published zero is valid.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor={id + "-amount"} className="text-sm font-medium">{physical ? "Sample source cost (NGN)" : policy.key === "manual_cash" ? "Sample recipient amount (NGN)" : "Sample available funds (NGN)"}</label>
              <Input id={id + "-amount"} inputMode={physical ? "decimal" : "numeric"} required value={amount} onChange={(e) => edit(setAmount, e.target.value)} />
            </div>
            {physical && <div className="space-y-2">
              <label htmlFor={id + "-delivery"} className="text-sm font-medium">Sample delivery (NGN)</label>
              <Input id={id + "-delivery"} inputMode="numeric" value={delivery} placeholder="Unknown" onChange={(e) => edit(setDelivery, e.target.value)} />
            </div>}
          </div>
          <div className="space-y-2">
            <label htmlFor={id + "-reason"} className="text-sm font-medium">Reason for this change</label>
            <Input id={id + "-reason"} required maxLength={1000} value={reason} onChange={(e) => edit(setReason, e.target.value)} />
          </div>
          <Button type="submit" variant="ghost">{busy ? "Working…" : "Preview rate"}</Button>
          {preview && proposal && <div className="space-y-4 rounded-xl bg-surface p-4" aria-live="polite">
            <h3 className="font-semibold">Review {proposal.rate_bps / 100}% for {POLICY_LABELS[policy.key].toLowerCase()}</h3>
            <p className="text-xs text-muted">Sample calculation only. This does not confirm a gift or authorize a payment.</p>
            <SampleBreakdown calculation={preview.calculation} />
            <p className="text-xs text-muted">Preview valid for ten minutes. Editing any field requires a new preview.</p>
            <Button type="button" onClick={() => void publish()}>Publish reviewed rate</Button>
          </div>}
        </fieldset>
      </form>
      {message && <p className={"mt-4 text-sm " + (failed ? "text-brand" : "text-muted")} role={failed ? "alert" : "status"}>{message}</p>}
    </section>
  );
}

export function PricingControls({ initial }: { initial: PolicyPage | null }) {
  const [page, setPage] = useState(initial);
  const [error, setError] = useState(initial ? "" : "Pricing records are unavailable. Check the database setup, then retry.");
  const [loading, setLoading] = useState(false);

  async function load(cursor = 0) {
    const response = await fetch("/api/admin/pricing/policies?cursor=" + cursor, { cache: "no-store" });
    if (!response.ok) throw new Error("Pricing records could not be loaded. Please retry.");
    const next: PolicyPage = await response.json();
    setPage((current) => ({ ...next, history: cursor && current ? [...current.history, ...next.history] : next.history }));
    setError("");
  }

  async function reload(cursor = 0) {
    setLoading(true);
    try { await load(cursor); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not refresh pricing."); }
    finally { setLoading(false); }
  }

  return (
    <main className="min-h-dvh bg-surface text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 md:px-8">
          <Link href="/" className="font-display text-2xl text-brand">Gifvtme</Link>
          <nav aria-label="Admin navigation" className="flex flex-wrap gap-4 text-sm">
            <Link href="/admin/gift-candidates" className="text-muted hover:underline">Gift candidates</Link>
            <Link href="/admin/pricing" aria-current="page" className="font-semibold text-brand">Gift pricing</Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8">
        <div className="max-w-2xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Pricing controls</p>
          <h1 className="font-display text-4xl">A clear price for every gift</h1>
          <p className="text-sm leading-6 text-muted">Set each rate, review its calculation, then publish. New estimates use the latest rate. Confirmed amounts keep their history.</p>
        </div>
        {error && <div className="space-y-3 rounded-xl border border-line bg-white p-4">
          <p role="alert" className="text-sm text-brand">{error}</p>
          <Button variant="ghost" disabled={loading} onClick={() => void reload()}>Retry loading</Button>
        </div>}
        {page && <>
          <div className="grid items-start gap-5 lg:grid-cols-2">{page.policies.map((policy) => <PolicyForm key={policy.key} policy={policy} refresh={() => load()} />)}</div>
          <section className="rounded-2xl border border-line bg-white p-5 md:p-6" aria-labelledby="pricing-history">
            <h2 id="pricing-history" className="text-xl font-semibold">Publication history</h2>
            <p className="mt-2 text-sm text-muted">Published versions remain available for explaining earlier amounts. Times are shown in Lagos time.</p>
            {page.history.length === 0 ? <p className="mt-5 text-sm text-muted">No rates have been published.</p> : <ol className="mt-5 divide-y divide-line">
              {page.history.map((version) => <li key={version.id} className="space-y-1 py-4 text-sm">
                <p className="font-semibold">{POLICY_LABELS[version.policy_key]} · {version.rate_bps / 100}% · Version {version.version}</p>
                <p className="break-words text-muted">{version.reason}</p>
                <p className="text-xs text-muted"><time dateTime={version.published_at}>{new Date(version.published_at).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</time></p>
                <p className="break-all text-xs text-muted">Operator reference: {version.publisher_audit_id}</p>
              </li>)}
            </ol>}
            {page.next_cursor !== null && <Button variant="ghost" disabled={loading} onClick={() => void reload(page.next_cursor!)}>Load older versions</Button>}
          </section>
        </>}
      </div>
    </main>
  );
}
