"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Clipboard, Loader2, UsersRound } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { AuthGateSheet } from "@/components/wishlist/AuthGateSheet";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { PoolProgress } from "@/components/pools/PoolProgress";
import { trackEvent } from "@/lib/analytics";
import {
  createPoolContributionFormSchema,
  type ContributeInput,
} from "@/lib/pools/validation";
import { createClient } from "@/lib/supabase/client";
import type { PoolPageData, PoolStatus } from "@/lib/pools/types";
import { cn, formatPrice } from "@/lib/utils";

type ContributionReturn = {
  status: "paid" | "pending_payment" | "failed" | null;
  amount: number | null;
  accepted: boolean;
  refundRequired: boolean;
};

const QUICK_AMOUNTS = [2000, 5000, 10000, 20000];
const IDEMPOTENCY_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StoredContributionAttempt = {
  idempotencyKey: string;
  selectedAmount: number;
};

function contributionAttemptStorageKey(poolId: string) {
  return `gifvtme:pool-contribution-attempt:${poolId}`;
}

function readContributionAttempt(
  poolId: string,
  memory: Map<string, StoredContributionAttempt>
) {
  const storageKey = contributionAttemptStorageKey(poolId);
  const memoryValue = memory.get(storageKey);
  if (memoryValue) return memoryValue;

  try {
    const stored = window.sessionStorage.getItem(storageKey);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<StoredContributionAttempt>;
    if (
      typeof parsed.idempotencyKey !== "string" ||
      !IDEMPOTENCY_KEY_PATTERN.test(parsed.idempotencyKey) ||
      typeof parsed.selectedAmount !== "number" ||
      !Number.isFinite(parsed.selectedAmount) ||
      parsed.selectedAmount <= 0
    ) return null;
    const attempt = parsed as StoredContributionAttempt;
    memory.set(storageKey, attempt);
    return attempt;
  } catch {
    return null;
  }
}

function storeContributionAttempt(
  poolId: string,
  attempt: StoredContributionAttempt,
  memory: Map<string, StoredContributionAttempt>
) {
  const storageKey = contributionAttemptStorageKey(poolId);
  memory.set(storageKey, attempt);
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(attempt));
  } catch {
    // Keep the retry key in memory when browser storage is unavailable.
  }
}

function clearContributionAttempt(poolId: string, memory: Map<string, StoredContributionAttempt>) {
  const storageKey = contributionAttemptStorageKey(poolId);
  memory.delete(storageKey);
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // The memory entry is still cleared when browser storage is unavailable.
  }
}

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
  const [previousServerProgress, setPreviousServerProgress] = useState(() => ({
    poolId: initialData.pool.id,
    amountRaised: initialData.pool.amount_raised,
    contributorCount: initialData.contributor_count,
    status: initialData.pool.status,
  }));
  const [contributionOpen, setContributionOpen] = useState(false);
  const [cashoutOpen, setCashoutOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [editTitleOpen, setEditTitleOpen] = useState(false);
  const [editedTitle, setEditedTitle] = useState(initialData.pool.title);
  const [authOpen, setAuthOpen] = useState(false);
  const [contributionStep, setContributionStep] = useState<1 | 2>(1);
  const [isCustomAmount, setIsCustomAmount] = useState(false);
  const [resumableAmount, setResumableAmount] = useState<number | undefined>();
  const [isWorking, setIsWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const contributionAttemptMemory = useRef(new Map<string, StoredContributionAttempt>());
  const pool = initialData.pool;
  const remaining = Math.max(0, pool.target_amount - amountRaised);
  const contributionFormSchema = useMemo(
    () => createPoolContributionFormSchema(pool.min_contribution, remaining, resumableAmount),
    [pool.min_contribution, remaining, resumableAmount],
  );
  const contributionForm = useForm<ContributeInput>({
    resolver: zodResolver(contributionFormSchema),
    mode: "onChange",
    defaultValues: { amount: Math.max(2000, pool.min_contribution) },
  });
  const [previousContributionReturnStatus, setPreviousContributionReturnStatus] =
    useState(contributionReturn.status);
  if (contributionReturn.status !== previousContributionReturnStatus) {
    setPreviousContributionReturnStatus(contributionReturn.status);
    if (contributionReturn.status === "paid") setResumableAmount(undefined);
  }
  const chosenAmount = useWatch({ control: contributionForm.control, name: "amount" }) || 0;
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

  if (
    initialData.pool.id !== previousServerProgress.poolId ||
    initialData.pool.amount_raised !== previousServerProgress.amountRaised ||
    initialData.contributor_count !== previousServerProgress.contributorCount ||
    initialData.pool.status !== previousServerProgress.status
  ) {
    const nextServerProgress = {
      poolId: initialData.pool.id,
      amountRaised: initialData.pool.amount_raised,
      contributorCount: initialData.contributor_count,
      status: initialData.pool.status,
    };
    setPreviousServerProgress(nextServerProgress);
    setAmountRaised(nextServerProgress.amountRaised);
    setContributorCount(nextServerProgress.contributorCount);
    setStatus(nextServerProgress.status);
  }

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

  useEffect(() => {
    if (contributionReturn.status === "paid") {
      clearContributionAttempt(pool.id, contributionAttemptMemory.current);
    }
  }, [contributionReturn.status, pool.id]);

  const openContribution = () => {
    if (!isAuthenticated) {
      setAuthOpen(true);
      return;
    }
    setContributionStep(1);
    const previousAttempt = readContributionAttempt(pool.id, contributionAttemptMemory.current);
    if (previousAttempt) {
      setIsCustomAmount(!QUICK_AMOUNTS.includes(previousAttempt.selectedAmount));
      setResumableAmount(previousAttempt.selectedAmount);
      contributionForm.reset({ amount: previousAttempt.selectedAmount });
    } else {
      const defaultAmount = Math.max(2000, pool.min_contribution);
      setIsCustomAmount(!QUICK_AMOUNTS.includes(defaultAmount));
      setResumableAmount(undefined);
      contributionForm.reset({ amount: defaultAmount });
    }
    contributionForm.clearErrors();
    setActionError(null);
    setContributionOpen(true);
  };

  const startPayment = async (values: ContributeInput) => {
    const selectedAmountValue = values.amount;
    const previousAttempt = readContributionAttempt(pool.id, contributionAttemptMemory.current);
    const isRetry = previousAttempt?.selectedAmount === selectedAmountValue;

    const attempt = isRetry && previousAttempt
      ? previousAttempt
      : {
          idempotencyKey: crypto.randomUUID(),
          selectedAmount: selectedAmountValue,
        };
    storeContributionAttempt(pool.id, attempt, contributionAttemptMemory.current);
    setResumableAmount(attempt.selectedAmount);
    const requestAmount = isRetry ? attempt.selectedAmount : cappedAmount;

    setIsWorking(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/pools/${pool.id}/contribute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": attempt.idempotencyKey,
        },
        body: JSON.stringify({ amount: requestAmount }),
      });
      const payload = await response.json().catch(() => null) as {
        error?: string;
        contribution_id?: string;
        payment_url?: string | null;
        already_paid?: boolean;
        payment_initializing?: boolean;
        attempt_ended?: boolean;
      } | null;
      if (!response.ok) {
        if (payload?.attempt_ended) {
          clearContributionAttempt(pool.id, contributionAttemptMemory.current);
          setResumableAmount(undefined);
        }
        throw new Error(payload?.error || "Couldn't start this contribution.");
      }
      if (!payload?.contribution_id) throw new Error("Couldn't start this contribution.");
      if (payload.payment_url) {
        window.location.assign(payload.payment_url);
        return;
      }
      if (payload.already_paid) {
        clearContributionAttempt(pool.id, contributionAttemptMemory.current);
        setContributionOpen(false);
        router.push(`/pool/${pool.token}?contributed=true&contribution_id=${payload.contribution_id}`);
        return;
      }
      if (payload.payment_initializing) {
        setActionError(payload.error || "Your payment link is still being prepared. Try again in a moment.");
        return;
      }
      throw new Error("Couldn't recover this payment link. Try again.");
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
      setStatus("paid_out");
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
      setStatus("cancelled");
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
  const submitContribution = (event: FormEvent<HTMLFormElement>) => {
    void contributionForm.handleSubmit(async (values) => {
      setActionError(null);
      if (contributionStep === 1) {
        setContributionStep(2);
        return;
      }
      await startPayment(values);
    })(event);
  };

  return (
    <>
      <div className="min-h-dvh bg-surface px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-3xl space-y-5">
          {acceptedReturn && contributionReturn.amount !== null && (
            <div role="status" className="rounded-2xl border border-success/20 bg-success/10 px-4 py-3 text-sm font-medium text-success">
              Thank you! Your contribution of {formatPrice(contributionReturn.amount)} has been received.
            </div>
          )}
          {contributionReturn.refundRequired && contributionReturn.amount !== null && (
            <div role="status" className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              Your payment of {formatPrice(contributionReturn.amount)} was captured after this pool closed. The Gifvtme team has been asked to refund it manually.
            </div>
          )}
          {contributionReturn.status === "pending_payment" && (
            <div role="status" className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              Your payment is being confirmed. Refresh this page in a moment to see the updated progress.
            </div>
          )}
          {contributionReturn.status === "failed" && (
            <div role="alert" className="rounded-2xl border border-danger/20 bg-brand-light px-4 py-3 text-sm text-brand">
              The payment wasn&apos;t completed. Nothing was added to this pool.
            </div>
          )}

          <section className="rounded-2xl bg-card p-5 shadow-sm sm:p-7">
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
            <section className="rounded-2xl bg-card p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-semibold text-ink">Contributors</h2>
              <ul className="mt-3 divide-y divide-line">
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
            <section className="space-y-4 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
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
                  <Button type="button" variant="text" fullWidth className="text-danger hover:bg-brand-light" onClick={() => { setActionError(null); setCancelOpen(true); }}>
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

          <form noValidate onSubmit={submitContribution} className="mt-5 space-y-4">
            {contributionStep === 1 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {amountChoices.map(({ amount, label }) => (
                    <button key={amount} type="button" onClick={() => {
                      setIsCustomAmount(false);
                      contributionForm.setValue("amount", amount, { shouldDirty: true, shouldValidate: true });
                    }}
                      className={cn(
                        "rounded-full border px-3 py-2.5 text-sm font-medium",
                        !isCustomAmount && chosenAmount === amount
                          ? "border-brand bg-brand-light text-brand"
                          : "border-line bg-card text-ink hover:border-brand/40",
                      )}>
                      {label}
                    </button>
                  ))}
                  <button type="button" onClick={() => {
                    setIsCustomAmount(true);
                    contributionForm.setValue("amount", pool.min_contribution, { shouldDirty: true, shouldValidate: true });
                  }}
                    className={cn(
                      "rounded-full border px-3 py-2.5 text-sm font-medium",
                      isCustomAmount
                        ? "border-brand bg-brand-light text-brand"
                        : "border-line bg-card text-ink hover:border-brand/40",
                    )}>
                    Custom
                  </button>
                </div>
                {isCustomAmount && (
                  <div className="space-y-1.5">
                    <label htmlFor="custom-contribution" className="text-xs font-medium text-ink">Amount in Naira</label>
                    <Input id="custom-contribution" type="number" min={pool.min_contribution} step={1} aria-invalid={Boolean(contributionForm.formState.errors.amount)} {...contributionForm.register("amount", { valueAsNumber: true })} />
                  </div>
                )}
                {contributionForm.formState.errors.amount?.message && <p role="alert" className="text-sm text-brand">{contributionForm.formState.errors.amount.message}</p>}
                {chosenAmount > remaining && (
                  <p className="rounded-xl bg-brand-light px-3 py-2 text-sm text-brand">
                    You&apos;re contributing {formatPrice(remaining)} to complete this pool.
                  </p>
                )}
                {remaining < pool.min_contribution && remaining > 0 && (
                  <p className="rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning">
                    The remaining amount is below the pool&apos;s minimum contribution.
                  </p>
                )}
                {actionError && <p role="alert" className="text-sm text-brand">{actionError}</p>}
                <Button type="submit" fullWidth disabled={contributionForm.formState.isSubmitting}>
                  Proceed to payment
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl bg-surface p-4 text-sm">
                  <p className="font-semibold text-ink">{formatPrice(cappedAmount)}</p>
                  <p className="mt-1 text-muted">Contributing to {pool.title}</p>
                </div>
                {contributionForm.formState.errors.amount?.message && <p role="alert" className="text-sm text-brand">{contributionForm.formState.errors.amount.message}</p>}
                {actionError && <p role="alert" className="text-sm text-brand">{actionError}</p>}
                <div className="flex gap-3">
                  <Button type="button" variant="ghost" fullWidth disabled={isWorking} onClick={() => setContributionStep(1)}>Back</Button>
                  <Button type="submit" fullWidth disabled={isWorking || contributionForm.formState.isSubmitting}>
                    {isWorking || contributionForm.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Pay with Flutterwave
                  </Button>
                </div>
              </div>
            )}
          </form>
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
            <Button type="button" disabled={isWorking} className="bg-danger text-primary-foreground hover:bg-primary-hover" onClick={() => void cancelPool()}>
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
