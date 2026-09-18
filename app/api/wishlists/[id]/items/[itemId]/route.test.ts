import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  assertWishlistOwner,
  getAuthenticatedApiUser,
} from "@/lib/wishlist/server";
import { DELETE } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/wishlist/server", () => ({
  assertWishlistOwner: vi.fn(),
  getAuthenticatedApiUser: vi.fn(),
  signWishlistImage: vi.fn(),
  syncMasterItemFromWishlistItem: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);
const mockedAssertWishlistOwner = vi.mocked(assertWishlistOwner);
const mockedGetAuthenticatedApiUser = vi.mocked(getAuthenticatedApiUser);

function context(id = "wishlist-1", itemId = "item-1") {
  return { params: Promise.resolve({ id, itemId }) };
}

/**
 * DELETE runs
 *   from("wishlist_items").update({...}).eq("id", ...).eq("wishlist_id", ...)
 * and awaits the second .eq().
 */
function mockDelete(error: { message: string } | null = null) {
  const secondEq = vi.fn().mockResolvedValue({ error });
  const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
  const update = vi.fn().mockReturnValue({ eq: firstEq });
  const from = vi.fn().mockReturnValue({ update });

  // @ts-expect-error only .from is read by this handler
  mockedCreateClient.mockResolvedValue({ from });

  return { from, update, firstEq, secondEq };
}

function ownedWishlist() {
  mockedAssertWishlistOwner.mockResolvedValue({
    ok: true as const,
    wishlist: { id: "wishlist-1", user_id: "user-1", type: "evergreen" },
  });
}

describe("DELETE /api/wishlists/[id]/items/[itemId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("archives the item and returns 204 so the owner's surfaces can resync", async () => {
    mockedGetAuthenticatedApiUser.mockResolvedValue({ id: "user-1" } as User);
    ownedWishlist();
    const { from, update, firstEq, secondEq } = mockDelete();

    const response = await DELETE(new Request("http://localhost"), context());

    expect(response.status).toBe(204);
    expect(from).toHaveBeenCalledWith("wishlist_items");
    expect(update).toHaveBeenCalledWith({ status: "archived" });
    expect(firstEq).toHaveBeenCalledWith("id", "item-1");
    expect(secondEq).toHaveBeenCalledWith("wishlist_id", "wishlist-1");
  });

  it("returns 500 when the update fails, so the client keeps showing the item", async () => {
    mockedGetAuthenticatedApiUser.mockResolvedValue({ id: "user-1" } as User);
    ownedWishlist();
    mockDelete({ message: "boom" });

    const response = await DELETE(new Request("http://localhost"), context());
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Couldn't delete item. Try again.");
  });

  it("returns 401 and touches nothing when there is no authenticated user", async () => {
    mockedGetAuthenticatedApiUser.mockResolvedValue(null);
    const { update } = mockDelete();

    const response = await DELETE(new Request("http://localhost"), context());

    expect(response.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it("returns 404 without deleting when the wishlist is not the caller's", async () => {
    mockedGetAuthenticatedApiUser.mockResolvedValue({ id: "user-2" } as User);
    mockedAssertWishlistOwner.mockResolvedValue({
      ok: false as const,
      status: 404,
      error: "Wishlist not found.",
    });
    const { update } = mockDelete();

    const response = await DELETE(new Request("http://localhost"), context());

    expect(response.status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });
});
