import { Star } from "lucide-react";
import type { ProductReviewsSummary } from "@/lib/sanity/types";

export function RatingBreakdown({
  reviews,
}: {
  reviews: ProductReviewsSummary;
}) {
  return (
    <div className="grid gap-6 rounded-2xl border border-stone-100 bg-white p-5 shadow-sm md:grid-cols-[180px_1fr]">
      <div>
        <p className="text-4xl font-bold text-ink">{reviews.avg.toFixed(1)}</p>
        <div className="mt-2 flex gap-1 text-amber-500">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className="h-4 w-4"
              fill={star <= Math.round(reviews.avg) ? "currentColor" : "none"}
            />
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">
          {reviews.count} {reviews.count === 1 ? "Review" : "Reviews"}
        </p>
      </div>

      <div className="space-y-3">
        {reviews.breakdown.map((row) => (
          <div key={row.star} className="flex items-center gap-3">
            <span className="w-14 text-sm text-muted">{row.star} star</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-amber-500"
                style={{ width: `${row.pct}%` }}
              />
            </div>
            <span className="w-10 text-right text-xs text-muted">{row.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
