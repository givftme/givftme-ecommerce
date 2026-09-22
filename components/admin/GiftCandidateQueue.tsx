"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { CheckCircle2, ExternalLink, Loader2, PencilLine, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { GiftMuseumCandidate, CandidateStatus, PublishMode } from "@/lib/gift-museum/types";
import { cn, formatPrice } from "@/lib/utils";

const STATUS_FILTERS: Array<CandidateStatus | "all"> = [
  "pending",
  "approved",
  "needs_edit",
  "published",
  "rejected",
  "all",
];

interface GiftCandidateQueueProps {
  initialCandidates: GiftMuseumCandidate[];
}

function numericValue(value: number | null) {
  return value == null ? "" : String(value);
}

function statusTone(status: CandidateStatus) {
  if (status === "published") return "bg-emerald-50 text-emerald-700";
  if (status === "approved") return "bg-orange-50 text-orange-700";
  if (status === "rejected") return "bg-stone-100 text-stone-600";
  if (status === "needs_edit") return "bg-amber-50 text-amber-700";
  return "bg-brand-light text-brand";
}

export function GiftCandidateQueue({ initialCandidates }: GiftCandidateQueueProps) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [filter, setFilter] = useState<CandidateStatus | "all">("pending");
  const [savingId, setSavingId] = useState<string | null>(null);
  const { toast } = useToast();

  const visibleCandidates = useMemo(
    () =>
      filter === "all"
        ? candidates
        : candidates.filter((candidate) => candidate.status === filter),
    [candidates, filter]
  );

  const replaceCandidate = (candidate: GiftMuseumCandidate) => {
    setCandidates((current) =>
      current.map((entry) => (entry.id === candidate.id ? candidate : entry))
    );
  };

  const patchCandidate = async (
    candidate: GiftMuseumCandidate,
    body: Record<string, unknown>
  ) => {
    setSavingId(candidate.id);
    try {
      const response = await fetch(`/api/admin/gift-candidates/${candidate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as {
        candidate?: GiftMuseumCandidate;
        error?: string;
      } | null;

      if (!response.ok || !payload?.candidate) {
        throw new Error(payload?.error || "Could not save candidate.");
      }

      replaceCandidate(payload.candidate);
      toast({ title: "Candidate saved", variant: "success" });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Could not save candidate.",
        variant: "danger",
      });
    } finally {
      setSavingId(null);
    }
  };

  const publishCandidate = async (candidate: GiftMuseumCandidate) => {
    setSavingId(candidate.id);
    try {
      const response = await fetch(
        `/api/admin/gift-candidates/${candidate.id}/publish`,
        { method: "POST", headers: { Accept: "application/json" } }
      );
      const payload = (await response.json().catch(() => null)) as {
        candidate?: GiftMuseumCandidate;
        error?: string;
      } | null;

      if (!response.ok || !payload?.candidate) {
        throw new Error(payload?.error || "Could not publish candidate.");
      }

      replaceCandidate(payload.candidate);
      toast({ title: "Candidate published", variant: "success" });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Could not publish candidate.",
        variant: "danger",
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f9]">
      <div className="sticky top-0 z-20 border-b border-stone-200/80 bg-[#f7f7f9]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-brand">
              Admin queue
            </p>
            <h1 className="mt-1 font-display text-3xl text-ink lg:text-4xl">
              Gift candidates
            </h1>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilter(status)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors",
                  filter === status
                    ? "bg-ink text-white"
                    : "bg-white text-muted hover:text-ink"
                )}
              >
                {status.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:px-8">
        {visibleCandidates.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-stone-200 bg-white p-10 text-center text-sm text-muted">
            No candidates in this filter.
          </div>
        ) : null}

        {visibleCandidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            isSaving={savingId === candidate.id}
            onPatch={(body) => patchCandidate(candidate, body)}
            onPublish={() => publishCandidate(candidate)}
          />
        ))}
      </main>
    </div>
  );
}

function CandidateCard({
  candidate,
  isSaving,
  onPatch,
  onPublish,
}: {
  candidate: GiftMuseumCandidate;
  isSaving: boolean;
  onPatch: (body: Record<string, unknown>) => void;
  onPublish: () => void;
}) {
  const [adminPrice, setAdminPrice] = useState(numericValue(candidate.admin_price_ngn));
  const [recommendedPrice, setRecommendedPrice] = useState(
    numericValue(candidate.recommended_price_ngn)
  );
  const [notes, setNotes] = useState(candidate.admin_notes || "");
  const [publishMode, setPublishMode] = useState<PublishMode>(candidate.publish_mode);
  const displayEstimate =
    candidate.admin_price_ngn ??
    candidate.recommended_price_ngn ??
    candidate.converted_price_ngn;

  return (
    <article className="grid gap-4 rounded-[2rem] border border-stone-100 bg-white p-4 shadow-sm lg:grid-cols-[180px_minmax(0,1fr)_320px]">
      <div className="relative aspect-square overflow-hidden rounded-[1.5rem] bg-surface">
        {candidate.image_url ? (
          <Image
            src={candidate.image_url}
            alt={candidate.title}
            fill
            sizes="180px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted">
            No image
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", statusTone(candidate.status))}>
            {candidate.status.replace("_", " ")}
          </span>
          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
            {candidate.merchant_label || candidate.merchant}
          </span>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-muted">
            Demand {candidate.demand_count}
          </span>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-muted">
            {candidate.scrape_confidence} confidence
          </span>
        </div>

        <h2 className="mt-3 text-xl font-semibold text-ink">{candidate.title}</h2>
        {candidate.description ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
            {candidate.description}
          </p>
        ) : null}

        <a
          href={candidate.canonical_url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex max-w-full items-center gap-1 truncate text-sm font-semibold text-brand"
        >
          <span className="truncate">{candidate.canonical_url}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Metric label="Source" value={
            candidate.source_price != null
              ? `${candidate.source_currency} ${candidate.source_price.toLocaleString()}`
              : "Missing"
          } />
          <Metric label="Converted" value={
            candidate.converted_price_ngn != null
              ? formatPrice(candidate.converted_price_ngn)
              : "Manual"
          } />
          <Metric label="Recommended" value={
            candidate.recommended_price_ngn != null
              ? formatPrice(candidate.recommended_price_ngn)
              : "Manual"
          } />
          <Metric label="Display" value={
            displayEstimate != null ? formatPrice(displayEstimate) : "Unset"
          } />
        </dl>
      </div>

      <div className="space-y-3 rounded-[1.5rem] bg-[#f7f7f9] p-3">
        <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Publish mode
          <select
            value={publishMode}
            onChange={(event) => setPublishMode(event.target.value as PublishMode)}
            className="mt-1 h-10 w-full rounded-full border border-stone-200 bg-white px-3 text-sm normal-case tracking-normal text-ink"
          >
            <option value="external_redirect">External wishlist only</option>
            <option value="catalog_checkout">Promote to catalog draft</option>
          </select>
        </label>

        <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Recommended NGN
          <input
            value={recommendedPrice}
            onChange={(event) => setRecommendedPrice(event.target.value)}
            inputMode="numeric"
            className="mt-1 h-10 w-full rounded-full border border-stone-200 bg-white px-3 text-sm normal-case tracking-normal text-ink"
          />
        </label>

        <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Final admin NGN
          <input
            value={adminPrice}
            onChange={(event) => setAdminPrice(event.target.value)}
            inputMode="numeric"
            className="mt-1 h-10 w-full rounded-full border border-stone-200 bg-white px-3 text-sm normal-case tracking-normal text-ink"
          />
        </label>

        <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-ink"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            isSaving={isSaving}
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Approve"
            onClick={() =>
              onPatch({
                status: "approved",
                publish_mode: publishMode,
                admin_notes: notes || null,
                admin_price_ngn: adminPrice ? Number(adminPrice) : null,
                recommended_price_ngn: recommendedPrice ? Number(recommendedPrice) : null,
              })
            }
          />
          <ActionButton
            isSaving={isSaving}
            icon={<PencilLine className="h-4 w-4" />}
            label="Save"
            onClick={() =>
              onPatch({
                publish_mode: publishMode,
                admin_notes: notes || null,
                admin_price_ngn: adminPrice ? Number(adminPrice) : null,
                recommended_price_ngn: recommendedPrice ? Number(recommendedPrice) : null,
              })
            }
          />
          <ActionButton
            isSaving={isSaving}
            icon={<XCircle className="h-4 w-4" />}
            label="Reject"
            variant="ghost"
            onClick={() => onPatch({ status: "rejected", admin_notes: notes || null })}
          />
          <ActionButton
            isSaving={isSaving}
            icon={<PencilLine className="h-4 w-4" />}
            label="Request edit"
            variant="ghost"
            onClick={() => onPatch({ status: "needs_edit", admin_notes: notes || null })}
          />
          <ActionButton
            isSaving={isSaving}
            icon={<Send className="h-4 w-4" />}
            label="Publish"
            variant="ghost"
            onClick={onPublish}
          />
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f7f7f9] p-3">
      <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  isSaving,
  onClick,
  variant = "filled",
}: {
  label: string;
  icon: ReactNode;
  isSaving: boolean;
  onClick: () => void;
  variant?: "filled" | "ghost";
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      disabled={isSaving}
      onClick={onClick}
      className="px-3"
    >
      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {label}
    </Button>
  );
}
