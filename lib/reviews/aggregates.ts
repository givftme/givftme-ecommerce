import type { RatingBreakdownRow } from "@/lib/sanity/types";

export interface RatingAggregates {
  count: number;
  average: number;
  breakdown: RatingBreakdownRow[];
}

// Pure so it's unit-testable without a database — spec's "Rating aggregates
// query" reimplemented as plain math over an already-fetched rating list.
export function calculateRatingAggregates(ratings: number[]): RatingAggregates {
  const count = ratings.length;
  const average = count > 0 ? ratings.reduce((sum, rating) => sum + rating, 0) / count : 0;
  const breakdown: RatingBreakdownRow[] = [5, 4, 3, 2, 1].map((star) => {
    const starCount = ratings.filter((rating) => rating === star).length;

    return {
      star,
      count: starCount,
      pct: count > 0 ? Math.round((starCount / count) * 100) : 0,
    };
  });

  return { count, average, breakdown };
}
