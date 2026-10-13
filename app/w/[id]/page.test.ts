import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSharedWishlist } from "@/lib/wishlist/shared";
import type { SharedWishlist, WishlistItem } from "@/lib/wishlist/types";
import { generateMetadata } from "./page";

vi.mock("@/lib/wishlist/shared", () => ({ getSharedWishlist: vi.fn() }));
vi.mock("@/lib/pricing/shared", () => ({ getSharedGiftEstimate: vi.fn() }));
vi.mock("@/components/wishlist/SharedWishlistClient", () => ({ SharedWishlistClient: () => null }));
vi.mock("@/components/wishlist/SharedWishlistNotice", () => ({ SharedWishlistNotice: () => null }));

const mockedGetSharedWishlist = vi.mocked(getSharedWishlist);

const SHARE_ID = "0123456789abcdef0123456789abcdef";

function item(id: string, status: WishlistItem["status"]): WishlistItem {
  return {
    id,
    wishlist_id: "wishlist-1",
    master_item_id: null,
    title: `Gift ${id}`,
    image_url: null,
    product_url: "https://shop.example.test/gift",
    affiliate_url: null,
    price: null,
    description: null,
    origin: "external",
    catalog_product_id: null,
    status,
    is_exclusive: false,
    sort_order: 0,
    created_at: null,
    intent_flagged_by: null,
    intent_flagged_at: null,
  };
}

function wishlist(overrides: Partial<SharedWishlist> = {}): SharedWishlist {
  return {
    id: "wishlist-1",
    title: "Birthday wishes",
    visibility: "public",
    cover_color: null,
    prices_visible: true,
    owner: { id: "owner-1", full_name: "Amaka", avatar_url: null },
    occasion: {
      id: "occasion-1",
      title: "Birthday",
      occasion_type: "birthday",
      occasion_date: "2026-11-01",
      status: "active",
    },
    items: [item("a", "available"), item("b", "available"), item("c", "purchased")],
    invite: null,
    share_id: SHARE_ID,
    viewer_is_owner: false,
    ...overrides,
  };
}

async function metadataFor(result: Awaited<ReturnType<typeof getSharedWishlist>>) {
  mockedGetSharedWishlist.mockResolvedValue(result);
  return generateMetadata({ params: Promise.resolve({ id: SHARE_ID }) });
}

beforeEach(() => vi.clearAllMocks());

describe("shared wishlist metadata", () => {
  it("builds the receiver and occasion title for a public list", async () => {
    const metadata = await metadataFor({ user: null, wishlist: wishlist(), status: "ok" });

    expect(metadata.title).toBe("Amaka's Birthday Wishlist");
    expect(metadata.description).toBe(
      "Help Amaka celebrate their Birthday — 3 wishes, 2 still available."
    );
    expect(metadata.robots).toBeUndefined();
    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({ url: `/api/og/wishlist/${SHARE_ID}`, width: 1200, height: 630 }),
    ]);
    expect(metadata.twitter).toEqual(
      expect.objectContaining({ card: "summary_large_image", images: [`/api/og/wishlist/${SHARE_ID}`] })
    );
  });

  it("drops the occasion when the list has none", async () => {
    const metadata = await metadataFor({
      user: null,
      wishlist: wishlist({ occasion: null }),
      status: "ok",
    });

    expect(metadata.title).toBe("Amaka's Wishlist");
  });

  it("keeps friends & family lists out of search results", async () => {
    const metadata = await metadataFor({
      user: null,
      wishlist: wishlist({ visibility: "friends_family" }),
      status: "ok",
    });

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("returns generic metadata for a private list, even to its owner", async () => {
    const metadata = await metadataFor({
      user: null,
      wishlist: wishlist({ visibility: "private" }),
      status: "ok",
    });

    expect(metadata.title).toBe("Wishlist");
    expect(JSON.stringify(metadata)).not.toContain("Amaka");
    expect(metadata.openGraph?.images).toEqual([expect.objectContaining({ url: "/og-default.jpg" })]);
  });

  it.each(["restricted", "not_found", "error"] as const)(
    "returns generic metadata when access is %s",
    async (status) => {
      const metadata = await metadataFor({ user: null, wishlist: null, status });

      expect(metadata.title).toBe("Wishlist");
      expect(metadata.description).toBe("View this wishlist on Givftme.");
    }
  );
});
