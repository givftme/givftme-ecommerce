// @vitest-environment jsdom

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import SharedWishlistLayout from "@/app/w/layout";
import { ToastProvider } from "@/components/ui/Toast";
import { sanityFetch } from "@/lib/sanity/fetch";
import type { ProductFullData } from "@/lib/sanity/types";
import { getSharedWishlist } from "@/lib/wishlist/shared";
import type { SharedWishlist, WishlistItem } from "@/lib/wishlist/types";
import SharedWishlistItemPage from "./page";

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/sanity/fetch", () => ({ sanityFetch: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("@/lib/wishlist/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wishlist/shared")>()),
  getSharedWishlist: vi.fn(),
}));

const mockedGetSharedWishlist = vi.mocked(getSharedWishlist);
const mockedSanityFetch = vi.mocked(sanityFetch);

const SHARE_ID = "share-key-1";

function item(overrides: Partial<WishlistItem> = {}): WishlistItem {
  return {
    id: "item-catalog",
    wishlist_id: "wishlist-1",
    master_item_id: null,
    title: "Copper pour over kettle",
    image_url: null,
    product_url: null,
    affiliate_url: null,
    price: 48000,
    description: "Slow spout, steady pour.",
    origin: "catalog",
    catalog_product_id: "product-1",
    status: "available",
    is_exclusive: false,
    sort_order: 0,
    created_at: null,
    intent_flagged_by: null,
    intent_flagged_at: null,
    ...overrides,
  };
}

const externalItem = item({
  id: "item-external",
  title: "Linen throw",
  origin: "external",
  catalog_product_id: null,
  product_url: "https://shop.example.test/linen-throw",
});

const purchasedItem = item({ id: "item-purchased", status: "purchased" });

function wishlist(items: WishlistItem[]): SharedWishlist {
  return {
    id: "wishlist-1",
    title: "Birthday wishes",
    visibility: "public",
    prices_visible: true,
    owner: { id: "owner-1", full_name: "Ada Obi", avatar_url: null },
    occasion: null,
    items,
    invite: null,
    share_id: SHARE_ID,
    viewer_is_owner: false,
  };
}

const catalogProduct = {
  id: "product-1",
  catalogProductId: "product-1",
  slug: "copper-pour-over-kettle",
  title: "Copper pour over kettle",
  price: 48000,
  status: "active",
  images: [],
  tags: [],
  attributes: [],
  variants: [],
  collections: [],
  hasVariants: false,
} satisfies ProductFullData;

const signedInUser = { id: "giver-1" } as User;

/** Renders the route exactly as Next composes it: the /w layout wrapping the page. */
async function renderItemPage(itemId: string) {
  const page = await SharedWishlistItemPage({
    params: Promise.resolve({ id: SHARE_ID, itemId }),
  });

  return renderToStaticMarkup(createElement(SharedWishlistLayout, null, page));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedSanityFetch.mockResolvedValue(catalogProduct);
  mockedGetSharedWishlist.mockResolvedValue({
    user: null,
    wishlist: wishlist([item(), externalItem, purchasedItem]),
    status: "ok",
  });
});

describe("Shared wishlist item page", () => {
  it("renders a catalog gift for a visitor with no account", async () => {
    const markup = await renderItemPage("item-catalog");

    expect(markup).toContain("Copper pour over kettle");
    expect(markup).toContain("Add to cart");
  });

  it("renders the same catalog gift for a signed in giver", async () => {
    mockedGetSharedWishlist.mockResolvedValue({
      user: signedInUser,
      wishlist: wishlist([item(), externalItem, purchasedItem]),
      status: "ok",
    });

    const markup = await renderItemPage("item-catalog");

    expect(markup).toContain("Copper pour over kettle");
    expect(markup).toContain("Add to cart");
  });

  it("renders an external gift with its redirect action intact", async () => {
    const markup = await renderItemPage("item-external");

    expect(markup).toContain("Linen throw");
    expect(markup).toContain("Buy this gift");
    expect(markup).not.toContain("Add to cart");
  });

  it("keeps the claimed state for an already purchased gift", async () => {
    const markup = await renderItemPage("item-purchased");

    expect(markup).toContain("already been claimed");
    expect(markup).not.toContain("Add to cart");
    expect(markup).not.toContain("Buy this gift");
  });
});

describe("Shared wishlist cart provider", () => {
  it("fails without the provider the /w layout mounts", async () => {
    const page = await SharedWishlistItemPage({
      params: Promise.resolve({ id: SHARE_ID, itemId: "item-catalog" }),
    });

    // The pre-fix layout: ToastProvider alone, no CartProvider.
    expect(() =>
      renderToStaticMarkup(createElement(ToastProvider, null, page))
    ).toThrow(/useCart must be used within CartProvider/);
  });
});
