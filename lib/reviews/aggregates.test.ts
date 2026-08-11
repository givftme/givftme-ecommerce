import { describe, expect, it } from "vitest";
import { calculateRatingAggregates } from "./aggregates";

describe("calculateRatingAggregates", () => {
  it("returns zeroed aggregates for no reviews", () => {
    const result = calculateRatingAggregates([]);

    expect(result.count).toBe(0);
    expect(result.average).toBe(0);
    expect(result.breakdown).toEqual([
      { star: 5, count: 0, pct: 0 },
      { star: 4, count: 0, pct: 0 },
      { star: 3, count: 0, pct: 0 },
      { star: 2, count: 0, pct: 0 },
      { star: 1, count: 0, pct: 0 },
    ]);
  });

  it("computes the correct average and breakdown from sample data", () => {
    const result = calculateRatingAggregates([5, 5, 4, 3, 1]);

    expect(result.count).toBe(5);
    expect(result.average).toBe(3.6);
    expect(result.breakdown).toEqual([
      { star: 5, count: 2, pct: 40 },
      { star: 4, count: 1, pct: 20 },
      { star: 3, count: 1, pct: 20 },
      { star: 2, count: 0, pct: 0 },
      { star: 1, count: 1, pct: 20 },
    ]);
  });

  it("breakdown percentages describe the same population the average was computed from", () => {
    const result = calculateRatingAggregates([5, 5, 5, 5]);

    expect(result.average).toBe(5);
    expect(result.breakdown.find((row) => row.star === 5)?.pct).toBe(100);
  });
});
