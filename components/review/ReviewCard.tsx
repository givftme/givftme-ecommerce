"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { formatRelativeTime } from "@/lib/utils";
import type { ProductReview } from "@/lib/sanity/types";

export function ReviewCard({
  review,
  productId,
  currentUserId,
  onDelete,
}: {
  review: ProductReview;
  productId: string;
  currentUserId: string | null;
  onDelete: (review: ProductReview) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isAuthor = Boolean(currentUserId) && review.userId === currentUserId;

  return (
    <article className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {review.reviewerAvatarUrl ? (
            <Image
              src={review.reviewerAvatarUrl}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-sm font-semibold text-brand">
              {(review.reviewerName || "G").charAt(0)}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-ink">
              {review.reviewerName || "Gifvtme customer"}
            </p>
            {review.createdAt ? (
              <p className="text-xs text-muted">{formatRelativeTime(review.createdAt)}</p>
            ) : null}
          </div>
        </div>
        <div className="flex gap-1 text-amber-500">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className="h-4 w-4"
              fill={star <= review.rating ? "currentColor" : "none"}
            />
          ))}
        </div>
      </div>

      {review.body ? (
        <div className="mt-4 text-sm leading-6 text-muted">
          <p className={expanded ? undefined : "line-clamp-3"}>{review.body}</p>
          {!expanded ? (
            <button
              type="button"
              onClick={() => {
                setExpanded(true);
                trackEvent("review.read_more.clicked", { review_id: review.id });
              }}
              className="mt-1 text-xs font-semibold text-brand"
            >
              Read more
            </button>
          ) : null}
        </div>
      ) : null}

      {isAuthor ? (
        <div className="mt-4 flex gap-4 border-t border-stone-100 pt-3 text-xs font-semibold">
          <Link
            href={`/reviews/new?product_id=${encodeURIComponent(productId)}`}
            className="text-brand hover:text-brand/80"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={() => onDelete(review)}
            className="text-red-600 hover:text-red-700"
          >
            Delete
          </button>
        </div>
      ) : null}
    </article>
  );
}
