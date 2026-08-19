"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { RatingBreakdown } from "@/components/product/RatingBreakdown";
import { ReviewCard } from "@/components/review/ReviewCard";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type {
  ProductReview,
  ProductReviewsSummary,
  ReviewsPage,
} from "@/lib/sanity/types";

export function ReviewsListSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 w-full rounded-2xl" />
      {[1, 2, 3].map((key) => (
        <Skeleton key={key} className="h-32 w-full rounded-2xl" />
      ))}
    </div>
  );
}

// Deleting a review shifts every later review up one slot in the
// offset-based `/api/reviews` pagination, so a plain local filter would
// leave an already-loaded page's worth of items stale and cause the next
// "Load more" to skip whichever review just shifted in. Re-fetching every
// page already loaded (not just the current one) keeps the loaded list and
// future pagination consistent, and also returns fresh average/breakdown
// totals in the same round trip since those are recomputed on every call.
async function fetchReviewsThroughPage(productId: string, throughPage: number) {
  const pageNumbers = Array.from({ length: throughPage }, (_, index) => index + 1);
  const responses = await Promise.all(
    pageNumbers.map(async (pageNumber) => {
      const response = await fetch(
        `/api/reviews?product_id=${encodeURIComponent(productId)}&page=${pageNumber}`,
      );

      if (!response.ok) {
        throw new Error("Could not load reviews.");
      }

      return (await response.json()) as ReviewsPage;
    }),
  );

  const last = responses[responses.length - 1];

  return {
    reviews: responses.flatMap((page) => page.reviews),
    total: last.total,
    average: last.average,
    breakdown: last.breakdown,
  };
}

export function ReviewsList({
  productId,
  initial,
  currentUserId,
  onSummaryChange,
}: {
  productId: string;
  initial: ProductReviewsSummary;
  currentUserId: string | null;
  onSummaryChange?: (summary: { count: number; avg: number }) => void;
}) {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<ProductReview[]>(initial.reviews);
  const [summary, setSummary] = useState({
    count: initial.count,
    avg: initial.avg,
    breakdown: initial.breakdown,
  });
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [canLeaveReview, setCanLeaveReview] = useState(initial.canLeaveReview);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductReview | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadMore = async () => {
    setLoadingMore(true);

    try {
      const nextPage = page + 1;
      const response = await fetch(
        `/api/reviews?product_id=${encodeURIComponent(productId)}&page=${nextPage}`,
      );
      
      if (!response.ok) {
        throw new Error("Could not load reviews.");
      }
      const payload = (await response.json()) as ReviewsPage;

      setReviews((current) => [...current, ...payload.reviews]);
      setPage(nextPage);
      setHasMore(payload.total > reviews.length + payload.reviews.length);
    } catch {
      toast({ title: "Couldn't load more reviews.", variant: "danger" });
    } finally {
      setLoadingMore(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch(`/api/reviews/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Delete failed.");
      }

      try {
        const refreshed = await fetchReviewsThroughPage(productId, page);

        setReviews(refreshed.reviews);
        setSummary({
          count: refreshed.total,
          avg: refreshed.average,
          breakdown: refreshed.breakdown,
        });
        setHasMore(refreshed.total > refreshed.reviews.length);
        onSummaryChange?.({ count: refreshed.total, avg: refreshed.average });
      } catch {
        // Best-effort fallback if the refetch itself fails — at least drop
        // the deleted review locally rather than leaving it on screen.
        // avg/breakdown/hasMore may be briefly stale until the next reload.
        setReviews((current) =>
          current.filter((review) => review.id !== deleteTarget.id),
        );
        setSummary((current) => ({
          ...current,
          count: Math.max(0, current.count - 1),
        }));
      }

      if (deleteTarget.userId === currentUserId) {
        setCanLeaveReview(true);
      }
      trackEvent("review.deleted", {});
      toast({ title: "Review deleted.", variant: "success" });
      setDeleteTarget(null);
    } catch {
      toast({
        title: "Couldn't delete your review. Please try again.",
        variant: "danger",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <RatingBreakdown
        reviews={{
          count: summary.count,
          avg: summary.avg,
          breakdown: summary.breakdown,
          reviews: [],
          canLeaveReview: false,
          hasMore: false,
        }}
      />

      {reviews.length === 0 ? (
        <p className="rounded-2xl border border-stone-100 bg-white p-6 text-center text-sm text-muted">
          No reviews yet. Be the first to share your experience!
        </p>
      ) : (
        reviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            productId={productId}
            currentUserId={currentUserId}
            onDelete={setDeleteTarget}
          />
        ))
      )}

      {hasMore ? (
        <Button
          type="button"
          variant="ghost"
          disabled={loadingMore}
          onClick={() => void loadMore()}
        >
          {loadingMore ? "Loading..." : "Load more reviews"}
        </Button>
      ) : null}

      {canLeaveReview ? (
        <Link
          href={`/reviews/new?product_id=${encodeURIComponent(productId)}`}
          className={cn(buttonVariants({ variant: "filled" }))}
        >
          <MessageCircle className="h-4 w-4" />
          Write a review
        </Link>
      ) : null}

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this review?</DialogTitle>
            <DialogDescription>This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "Deleting..." : "Delete review"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
