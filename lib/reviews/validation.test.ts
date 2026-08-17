import { describe, expect, it } from "vitest";
import { reviewFormSchema, reviewSchema, updateReviewSchema } from "./validation";

describe("reviewSchema", () => {
  it("accepts a rating-only review with no body", () => {
    const result = reviewSchema.safeParse({
      catalog_product_id: "product-1",
      rating: 4,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a missing rating", () => {
    const result = reviewSchema.safeParse({ catalog_product_id: "product-1" });

    expect(result.success).toBe(false);
  });

  it("rejects a rating out of range", () => {
    expect(
      reviewSchema.safeParse({ catalog_product_id: "product-1", rating: 0 }).success
    ).toBe(false);
    expect(
      reviewSchema.safeParse({ catalog_product_id: "product-1", rating: 6 }).success
    ).toBe(false);
  });

  it("rejects a body over 1000 characters", () => {
    const result = reviewSchema.safeParse({
      catalog_product_id: "product-1",
      rating: 5,
      body: "a".repeat(1001),
    });

    expect(result.success).toBe(false);
  });

  it("accepts a body at exactly 1000 characters", () => {
    const result = reviewSchema.safeParse({
      catalog_product_id: "product-1",
      rating: 5,
      body: "a".repeat(1000),
    });

    expect(result.success).toBe(true);
  });
});

describe("updateReviewSchema", () => {
  it("accepts a rating-only patch", () => {
    expect(updateReviewSchema.safeParse({ rating: 3 }).success).toBe(true);
  });

  it("accepts a body-only patch", () => {
    expect(updateReviewSchema.safeParse({ body: "Updated thoughts" }).success).toBe(true);
  });

  it("rejects an empty patch", () => {
    expect(updateReviewSchema.safeParse({}).success).toBe(false);
  });
});

describe("reviewFormSchema", () => {
  it("requires a rating even though the field is form-optional at the type level", () => {
    const result = reviewFormSchema.safeParse({ body: "" });

    expect(result.success).toBe(false);
  });
});
