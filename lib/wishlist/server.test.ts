import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getWishlistSummaries } from "@/lib/wishlist/server";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

type WishlistItemRow = { id: string; status?: string | null };

/**
 * getWishlistSummaries reads
 *   from("wishlists").select(...).eq("user_id", id).order("created_at", ...)
 * and awaits the result of .order().
 */
function mockSupabase(rows: unknown[]) {
  const order = vi.fn().mockResolvedValue({ data: rows, error: null });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return {
    client: { from } as unknown as SupabaseClient,
    select,
  };
}

function wishlistRow(items: WishlistItemRow[]) {
  return {
    id: "wishlist-1",
    title: "My Wishlist",
    type: "evergreen",
    visibility: "private",
    prices_visible: true,
    wishlist_items: items,
  };
}

describe("getWishlistSummaries", () => {
  it("reports zero items for a new user whose evergreen container is empty", async () => {
    const { client } = mockSupabase([wishlistRow([])]);

    const [summary] = await getWishlistSummaries(client, "user-1");

    expect(summary.id).toBe("wishlist-1");
    expect(summary.item_count).toBe(0);
  });

  it("reports zero after the only item is deleted, since delete archives the row", async () => {
    const { client } = mockSupabase([
      wishlistRow([{ id: "item-1", status: "archived" }]),
    ]);

    const [summary] = await getWishlistSummaries(client, "user-1");

    // This is the phantom "1 item" case: the row still exists after a soft
    // delete, so counting rows rather than active items showed a stale 1.
    expect(summary.item_count).toBe(0);
  });

  it("counts only the items that survive a deletion", async () => {
    const { client } = mockSupabase([
      wishlistRow([
        { id: "item-1", status: "available" },
        { id: "item-2", status: "archived" },
        { id: "item-3", status: "available" },
        { id: "item-4", status: "purchased" },
      ]),
    ]);

    const [summary] = await getWishlistSummaries(client, "user-1");

    expect(summary.item_count).toBe(3);
  });

  it("selects item status so the count can exclude archived rows", async () => {
    const { client, select } = mockSupabase([wishlistRow([])]);

    await getWishlistSummaries(client, "user-1");

    expect(select).toHaveBeenCalledWith(
      expect.stringContaining("wishlist_items(id, status)"),
    );
  });

  it("returns an empty list when the user has no wishlists at all", async () => {
    const { client } = mockSupabase([]);

    await expect(getWishlistSummaries(client, "user-1")).resolves.toEqual([]);
  });

  it("throws when the query fails rather than reporting a zero count", async () => {
    const order = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "boom" } });
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order }) }),
      }),
    } as unknown as SupabaseClient;

    await expect(getWishlistSummaries(client, "user-1")).rejects.toThrow("boom");
  });
});
