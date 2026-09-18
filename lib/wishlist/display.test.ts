import { describe, expect, it } from "vitest";
import { countVisibleWishlistItems } from "@/lib/wishlist/display";

describe("countVisibleWishlistItems", () => {
  it("counts zero for a wishlist container that has no items", () => {
    // A newly created user gets an evergreen wishlist container. The container
    // existing must never read as one item.
    expect(countVisibleWishlistItems([])).toBe(0);
  });

  it("counts zero when the relation is missing or null", () => {
    expect(countVisibleWishlistItems(undefined)).toBe(0);
    expect(countVisibleWishlistItems(null)).toBe(0);
  });

  it("excludes archived rows, which is what deletion leaves behind", () => {
    expect(
      countVisibleWishlistItems([
        { status: "available" },
        { status: "archived" },
      ]),
    ).toBe(1);
  });

  it("returns zero once the last remaining item is archived", () => {
    expect(countVisibleWishlistItems([{ status: "archived" }])).toBe(0);
  });

  it("still counts purchased items, matching the detail page", () => {
    expect(
      countVisibleWishlistItems([
        { status: "available" },
        { status: "purchased" },
        { status: "archived" },
      ]),
    ).toBe(2);
  });

  it("treats a missing status as an active item", () => {
    expect(countVisibleWishlistItems([{}, { status: null }])).toBe(2);
  });

  it("tracks each transition in the item count contract", () => {
    const active = (count: number) =>
      Array.from({ length: count }, () => ({ status: "available" }));

    // 0 -> 1 -> 2, then 4 -> 3, 2 -> 1, 1 -> 0 as rows get archived.
    expect(countVisibleWishlistItems(active(0))).toBe(0);
    expect(countVisibleWishlistItems(active(1))).toBe(1);
    expect(countVisibleWishlistItems(active(2))).toBe(2);
    expect(
      countVisibleWishlistItems([...active(3), { status: "archived" }]),
    ).toBe(3);
    expect(
      countVisibleWishlistItems([...active(1), { status: "archived" }]),
    ).toBe(1);
    expect(
      countVisibleWishlistItems([
        { status: "archived" },
        { status: "archived" },
      ]),
    ).toBe(0);
  });
});
