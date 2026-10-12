"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clipboard, Loader2, UsersRound } from "lucide-react";
import { AuthGateSheet } from "@/components/wishlist/AuthGateSheet";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { PoolProgress } from "@/components/pools/PoolProgress";
import { trackEvent } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import type { PoolPageData, PoolStatus } from "@/lib/pools/types";
import { formatPrice } from "@/lib/utils";

type ContributionReturn = {
  status: "paid" | "pending_payment" | "failed" | null;
  amount: number | null;
  accepted: boolean;
  refundRequired: boolean;
};

const QUICK_AMOUNTS = [2000, 5000, 10000, 20000];

function getInitials(name: string | null) {
  if (!name) return "G";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "G";
}

function statusMessage(status: PoolStatus, isGeneralPool: boolean) {
  if (status === "fully_funded") return "🎉 This pool is fully funded!";
  if (status === "procured") return "This gift has been fulfilled.";
  if (status === "paid_out") return isGeneralPool
    ? "This gift fund has been paid out to the receiver."
    : "This gift has been fulfilled.";
  if (status === "cancelled") return "This pool has been cancelled.";
  return null;
}

export function PoolPageClient({
  initialData,
  isAuthenticated,
  contributionReturn,
}: {
  initialData: PoolPageData;
  isAuthenticated: boolean;
  contributionReturn: ContributionReturn;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [amountRaised, setAmountRaised] = useState(initialData.pool.amount_raised);
  const [contributorCount, setContributorCount] = useState(initialData.contributor_count);
  const [status, setStatus] = useState<PoolStatus>(initialData.pool.status);
  const [contributionOpen, setContributionOpen] = useState(false);
  const [cashoutOpen, setCashoutOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [editTitleOpen, setEditTitleOpen] = useState(false);
  const [editedTitle, setEditedTitle] = useState(initialData.pool.title);
  const [authOpen, setAuthOpen] = useState(false);
  const [contributionStep, setContributionStep] = useState<1 | 2>(1);
  const [selectedAmount, setSelectedAmount] = useState(String(initialData.pool.min_contribution));
  const [customAmount, setCustomAmount] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const pool = initialData.pool;
  const remaining = Math.max(0, pool.target_amount - amountRaised);
  const chosenAmount = selectedAmount === "custom" ? Number(customAmount) : Number(selectedAmount);
  const cappedAmount = Math.min(chosenAmount || 0, remaining);
  const poolUrl = typeof window === "undefined" ? `/pool/${pool.token}` : `${window.location.origin}/pool/${pool.token}`;
  const displayOrganiser = initialData.creator.full_name || initialData.receiver.full_name || "a Gifvtme member";
  const finalStatusMessage = statusMessage(status, !pool.wishlist_item_id);
  const canContribute = status === "open" && remaining > 0;

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`group-pool-progress:${pool.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "group_gift_pool_progress",
        filter: `pool_id=eq.${pool.id}`,
      }, (payload) => {
        const row = payload.new as {
          amount_raised?: number;
          contributor_count?: number;
          status?: PoolStatus;
        };
        if (typeof row.amount_raised === "number") setAmountRaised(row.amount_raised);
        if (typeof row.contributor_count === "number") setContributorCount(row.contributor_count);
        if (row.status) setStatus(row.status);
        router.refresh();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [pool.id, router]);

  useEffect(() => {
    trackEvent("pool.viewed", {
      pool_id: pool.id,
      viewer_type: initialData.viewer_is_receiver
        ? "receiver"
        : initialData.viewer_is_creator
          ? "creator"
          : isAuthenticated ? "contributor" : "public",
    });
  }, [initialData.viewer_is_creator, initialData.viewer_is_receiver, isAuthenticated, pool.id]);

  const openContribution = () => {
    if (!isAuthenticated) {
      setAuthOpen(true);
      return;
    }
    setContributionStep(1);
    setSelectedAmount(String(Math.max(2000, pool.min_contribution)));
    setCustomAmount("");
    setActionError(null);
    setContributionOpen(true);
  };

  const startPayment = async () => {
    if (cappedAmount < pool.min_contribution) {
      setActionError(`Minimum contribution is ${formatPrice(pool.min_contribution)}.`);
      return;
    }

    setIsWorking(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/pools/${pool.id}/contribute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ amount: cappedAmount }),
      });
      const payload = await response.json().catch(() => null) as {
        error?: string;
        contribution_id?: string;
        payment_url?: string | null;
      } | null;
      if (!response.ok || !payload?.contribution_id) {
        throw new Error(payload?.error || "Couldn't start this contribution.");
      }
      if (payload.payment_url) {
        window.location.assign(payload.payment_url);
        return;
      }
      setContributionOpen(false);
      router.push(`/pool/${pool.token}?contributed=true&contribution_id=${payload.contribution_id}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Couldn't start this contribution.");
    } finally {
      setIsWorking(false);
    }
  };

  const updateTitle = async () => {
    setIsWorking(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/pools/${pool.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editedTitle.trim() }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Couldn't update this pool title.");
      setEditTitleOpen(false);
      toast({ title: "Pool title updated.", variant: "success" });
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Couldn't update this pool title.");
    } finally {
      setIsWorking(false);
    }
  };

  const cashOut = async () => {
    setIsWorking(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/pools/${pool.id}/cash-out`, { method: "POST" });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Couldn't cash out this pool.");
      setCashoutOpen(false);
      toast({ title: "Cash out requested. The Gifvtme team will process the transfer.", variant: "success" });
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Couldn't cash out this pool.");
    } finally {
      setIsWorking(false);
    }
  };

  const cancelPool = async () => {
    setIsWorking(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/pools/${pool.id}/cancel`, { method: "POST" });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Couldn't cancel this pool.");
      setCancelOpen(false);
      toast({ title: "Pool cancelled.", variant: "success" });
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Couldn't cancel this pool.");
    } finally {
      setIsWorking(false);
    }
  };

  const copyPoolLink = async () => {
    try {
      await navigator.clipboard.writeText(poolUrl);
      toast({ title: "Pool link copied.", variant: "success" });
      trackEvent("pool.link.copied", { pool_id: pool.id });
    } catch {
      toast({ title: "Couldn't copy the link. Copy it from your browser address bar.", variant: "danger" });
    }
  };

  const acceptedReturn = contributionReturn.accepted;
  const amountChoices = useMemo(() => QUICK_AMOUNTS.map((amount) => ({
    amount,
    label: formatPrice(amount),
  })), []);

  return (
    <>
      <div className="min-h-dvh bg-surface px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-3xl space-y-5">
          {acceptedReturn && contributionReturn.amount !== null && (
            <div role="status" className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
              Thank you! Your contribution of {formatPrice(contributionReturn.amount)} has been received.
            </div>
          )}
          {contributionReturn.refundRequired && contributionReturn.amount !== null && (
            <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Your payment of {formatPrice(contributionReturn.amount)} was captured after this pool closed. The Gifvtme team has been asked to refund it manually.
            </div>
          )}
          {contributionReturn.status === "pending_payment" && (
            <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Your payment is being confirmed. Refresh this page in a moment to see the updated progress.
            </div>
          )}
          {contributionReturn.status === "failed" && (
            <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-brand">
              The payment wasn't completed. Nothing was added to this pool.
            </div>
          )}

          <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
              {pool.wishlist_item_id ? "Item gift pool" : "Gift fund"}
            </p>
            <h1 className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl">{pool.title}</h1>
            <p className="mt-3 text-sm text-muted">
              Organised by {displayOrganiser}
              {pool.created_by !== pool.receiver_id ? ` · For ${initialData.receiver.full_name || "the receiver"}` : ""}
              {!pool.wishlist_item_id ? ` · ${initialData.wishlist_title}` : ""}
            </p>
            {initialData.item && (
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-surface p-3">
                {initialData.item.image_url ? <img src={initialData.item.image_url} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-light text-brand"><UsersRound className="h-5 w-5" /></div>}
                <div className="min-w-0">
                  <p className="text-xs text-muted">For {initialData.receiver.full_name || "the receiver"}</p>
                  <p className="truncate text-sm font-semibold text-ink">{initialData.item.title}</p>
                </div>
              </div>
            )}
            {pool.message && <p className="mt-4 text-sm italic leading-6 text-muted">“{pool.message}”</p>}
          </section>

          <PoolProgress raised={amountRaised} target={pool.target_amount} contributorCount={contributorCount} />

          {contributorCount === 0 && status === "open" && (
            <p className="px-2 text-center text-sm text-muted">Be the first to contribute!</p>
          )}

          {initialData.contributors && initialData.contributors.length > 0 && (
            <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-semibold text-ink">Contributors</h2>
              <ul className="mt-3 divide-y divide-stone-100">
                {initialData.contributors.map((contributor) => (
                  <li key={contributor.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    {contributor.avatar_url
                      ? <img src={contributor.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                      : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand">{getInitials(contributor.full_name)}</span>}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{contributor.full_name || "Gifvtme member"}</span>
                    <span className="text-sm font-semibold text-brand">{formatPrice(contributor.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {finalStatusMessage ? (
            <div className="rounded-2xl bg-brand-light px-5 py-4 text-center text-sm font-semibold text-brand" role="status">
              {finalStatusMessage}
            </div>
          ) : canContribute ? (
            <Button type="button" size="lg" fullWidth onClick={openContribution}>
              Contribute to this pool
            </Button>
          ) : null}

          {initialData.viewer_is_manager && (
            <section className="space-y-4 rounded-2xl border border-stone-100 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-ink">Manage this pool</h2>
                  <p className="mt-1 text-sm text-muted">Share the link or request the cash raised so far.</p>
                </div>
                <Button type="button" variant="ghost" onClick={() => void copyPoolLink()}>
                  <Clipboard className="h-4 w-4" aria-hidden="true" /> Share link
                </Button>
              </div>
              {initialData.viewer_is_receiver && (
                <Button type="button" variant="text" onClick={() => { setEditedTitle(pool.title); setActionError(null); setEditTitleOpen(true); }}>
                  Edit pool title
                </Button>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                {(status === "open" || status === "fully_funded") && (
                  <Button type="button" variant="ghost" fullWidth onClick={() => { setActionError(null); setCashoutOpen(true); }}>
                    Cash out
                  </Button>
                )}
                {initialData.creator.id === pool.created_by && status === "open" && pool.amount_raised === 0 && (
                  <Button type="button" variant="text" fullWidth className="text-red-700 hover:bg-red-50" onClick={() => { setActionError(null); setCancelOpen(true); }}>
                    Cancel pool
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted">The Gifvtme team processes cash transfers manually. Contributions are non-refundable unless a pool is cancelled before contributions are completed.</p>
            </section>
          )}

        </div>
      </div>

      <Dialog open={contributionOpen} onOpenChange={setContributionOpen}>
        <DialogContent className="top-auto bottom-0 left-0 w-full max-w-none translate-x-0 translate-y-0 rounded-b-none rounded-t-2xl p-5 md:left-1/2 md:top-1/2 md:bottom-auto md:w-[calc(100%-2rem)] md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:p-6">
          <DialogHeader>
            <DialogTitle>{contributionStep === 1 ? "Choose an amount" : "Confirm contribution"}</DialogTitle>
            <DialogDescription>
              {contributionStep === 1
                ? `Minimum ${formatPrice(pool.min_contribution)} · ${formatPrice(remaining)} remaining to reach the target`
                : `Contributing ${formatPrice(cappedAmount)} to ${pool.title}`}
            </DialogDescription>
          </DialogHeader>

          {contributionStep === 1 ? (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {amountChoices.map(({ amount, label }) => (
                  <button key={amount} type="button" onClick={() => setSelectedAmount(String(amount))}
                    className={`rounded-full border px-3 py-2.5 text-sm font-medium ${selectedAmount === String(amount) ? "border-brand bg-brand-light text-brand" : "border-stone-200 bg-white text-ink hover:border-brand/40"}`}>
                    {label}
                  </button>
                ))}
                <button type="button" onClick={() => setSelectedAmount("custom")}
                  className={`rounded-full border px-3 py-2.5 text-sm font-medium ${selectedAmount === "custom" ? "border-brand bg-brand-light text-brand" : "border-stone-200 bg-white text-ink hover:border-brand/40"}`}>
                  Custom
                </button>
              </div>
              {selectedAmount === "custom" && (
                <div className="space-y-1.5">
                  <label htmlFor="custom-contribution" className="text-xs font-medium text-ink">Amount in Naira</label>
                  <Input id="custom-contribution" type="number" min={pool.min_contribution} step={1} value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} placeholder="Enter an amount" />
                </div>
              )}
              {chosenAmount > remaining && (
                <p className="rounded-xl bg-brand-light px-3 py-2 text-sm text-brand">
                  You&apos;re contributing {formatPrice(remaining)} to complete this pool.
                </p>
              )}
              {remaining < pool.min_contribution && remaining > 0 && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  The remaining amount is below the pool&apos;s minimum contribution.
                </p>
              )}
              {actionError && <p role="alert" className="text-sm text-brand">{actionError}</p>}
              <Button type="button" fullWidth disabled={!Number.isInteger(cappedAmount) || cappedAmount < pool.min_contribution} onClick={() => { setActionError(null); setContributionStep(2); }}>
                Proceed to payment
              </Button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl bg-surface p-4 text-sm">
                <p className="font-semibold text-ink">{formatPrice(cappedAmount)}</p>
                <p className="mt-1 text-muted">Contributing to {pool.title}</p>
              </div>
              {actionError && <p role="alert" className="text-sm text-brand">{actionError}</p>}
              <div className="flex gap-3">
                <Button type="button" variant="ghost" fullWidth disabled={isWorking} onClick={() => setContributionStep(1)}>Back</Button>
                <Button type="button" fullWidth disabled={isWorking} onClick={() => void startPayment()}>
                  {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Pay with Flutterwave
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={cashoutOpen} onOpenChange={setCashoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cash out this pool?</DialogTitle>
            <DialogDescription>
              {formatPrice(amountRaised)} will be paid to {initialData.receiver.full_name || "the receiver"}.
              {pool.wishlist_item_id && status !== "fully_funded" ? " This item won't be procured; the receiver will get the cash raised instead." : ""}
              {` All ${contributorCount} contributors will be notified.`}
            </DialogDescription>
          </DialogHeader>
          {actionError && <p role="alert" className="mt-4 text-sm text-brand">{actionError}</p>}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button type="button" variant="ghost" disabled={isWorking} onClick={() => setCashoutOpen(false)}>Cancel</Button>
            <Button type="button" disabled={isWorking} onClick={() => void cashOut()}>
              {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Confirm cash out
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editTitleOpen} onOpenChange={setEditTitleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit pool title</DialogTitle>
            <DialogDescription>The target amount stays fixed to protect contributors who have already paid.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <Input value={editedTitle} maxLength={100} onChange={(event) => setEditedTitle(event.target.value)} aria-label="Pool title" />
            {actionError && <p role="alert" className="text-sm text-brand">{actionError}</p>}
            <div className="flex gap-3">
              <Button type="button" variant="ghost" fullWidth disabled={isWorking} onClick={() => setEditTitleOpen(false)}>Cancel</Button>
              <Button type="button" fullWidth disabled={isWorking || editedTitle.trim().length < 3} onClick={() => void updateTitle()}>
                {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save title
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this pool?</DialogTitle>
            <DialogDescription>No contributions have been applied to this pool. The share link will stop accepting payments.</DialogDescription>
          </DialogHeader>
          {actionError && <p role="alert" className="mt-4 text-sm text-brand">{actionError}</p>}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button type="button" variant="ghost" disabled={isWorking} onClick={() => setCancelOpen(false)}>Keep pool</Button>
            <Button type="button" disabled={isWorking} className="bg-red-700 hover:bg-red-800" onClick={() => void cancelPool()}>
              {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Cancel pool
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AuthGateSheet
        open={authOpen}
        onOpenChange={setAuthOpen}
        redirectPath={`/pool/${pool.token}`}
        description="Sign in to contribute to this gift pool and receive your payment receipt."
      />
    </>
  );
}
