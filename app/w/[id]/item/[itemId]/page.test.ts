// @vitest-environment jsdom

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLinkedGiftEstimate, unavailableEstimate } from "@/lib/pricing/estimate";
import type { User } from "@supabase/supabase-js";
import SharedWishlistLayout from "@/app/w/layout";
import { ToastProvider } from "@/components/ui/Toast";
import { sanityFetch } from "@/lib/sanity/fetch";
import type { ProductFullData } from "@/lib/sanity/types";
import { getSharedWishlist } from "@/lib/wishlist/shared";
import type { SharedWishlist, WishlistItem } from "@/lib/wishlist/types";
import SharedWishlistItemPage from "./page";
import SharedWishlistPage from "@/app/w/[id]/page";
import { formatPrice } from "@/lib/utils";

vi.mock("@/lib/pricing/estimate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pricing/estimate")>()),
  getLinkedGiftEstimate: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/sanity/fetch", () => ({ sanityFetch: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
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
    cover_color: null,
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

afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GIFT_PRICING_V1_ENABLED", "false");
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
    expect(markup).toContain("Buy this gift");
  });

  it("renders the same catalog gift for a signed in giver", async () => {
    mockedGetSharedWishlist.mockResolvedValue({
      user: signedInUser,
      wishlist: wishlist([item(), externalItem, purchasedItem]),
      status: "ok",
    });

    const markup = await renderItemPage("item-catalog");

    expect(markup).toContain("Copper pour over kettle");
    expect(markup).toContain("Buy this gift");
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
    expect(markup).not.toContain("Buy this gift");
  });
});

async function renderWishlistPage() {
  const page = await SharedWishlistPage({
    params: Promise.resolve({ id: SHARE_ID }),
  });
  return renderToStaticMarkup(createElement(SharedWishlistLayout, null, page));
}

describe("Shared list and detail pricing", () => {
  it.each([
    ["estimate", "52800"],
    ["estimate", "0"],
    ["pricing_unavailable", null],
  ] as const)("agrees on %s with amount %s", async (state, amount) => {
    vi.stubEnv("GIFT_PRICING_V1_ENABLED", "true");
    mockedGetSharedWishlist.mockResolvedValue({
      user: null,
      wishlist: wishlist([externalItem]),
      status: "ok",
    });
    vi.mocked(getLinkedGiftEstimate).mockResolvedValue({
      ...unavailableEstimate(),
      state,
      gift_price_ngn: amount,
    });

    const detail = await renderItemPage(externalItem.id);
    const list = await renderWishlistPage();

    for (const markup of [detail, list]) {
      expect(markup).not.toContain(formatPrice(externalItem.price!));
      if (amount === null) {
        expect(markup).toContain("Gift pricing is unavailable");
        expect(markup).not.toContain("Gift estimate");
      } else {
        expect(markup).toContain("Gift estimate");
        expect(markup).toContain(formatPrice(Number(amount)));
        expect(markup).toContain("Delivery awaits confirmation");
      }
    }
  });
});

describe("Shared pricing visibility and item boundaries", () => {
  it.each([
    { name: "rollout disabled", enabled: false, visible: true, gift: externalItem },
    { name: "catalog gift", enabled: true, visible: true, gift: item() },
    { name: "external gift without a link", enabled: true, visible: true, gift: { ...externalItem, product_url: null } },
    { name: "hidden prices", enabled: true, visible: false, gift: externalItem },
  ])("preserves $name on both views", async ({ enabled, visible, gift }) => {
    vi.stubEnv("GIFT_PRICING_V1_ENABLED", String(enabled));
    mockedGetSharedWishlist.mockResolvedValue({
      user: null,
      wishlist: { ...wishlist([gift]), prices_visible: visible },
      status: "ok",
    });
    const views = [await renderWishlistPage(), await renderItemPage(gift.id)];
    expect(getLinkedGiftEstimate).not.toHaveBeenCalled();
    for (const markup of views) {
      expect(markup).not.toContain("Gift estimate");
      expect(markup).not.toContain("Gift pricing is unavailable");
      if (visible) expect(markup).toContain(formatPrice(gift.price!));
      else expect(markup).not.toContain(formatPrice(gift.price!));
    }
  });

  it("keeps each estimate with its own card and detail page", async () => {
    vi.stubEnv("GIFT_PRICING_V1_ENABLED", "true");
    const second = { ...externalItem, id: "second-item", title: "Another throw", price: 24000 };
    mockedGetSharedWishlist.mockResolvedValue({
      user: null,
      wishlist: wishlist([externalItem, second]),
      status: "ok",
    });
    vi.mocked(getLinkedGiftEstimate).mockImplementation(async (itemId) => ({
      ...unavailableEstimate(),
      state: "estimate",
      gift_price_ngn: itemId === externalItem.id ? "52800" : "26400",
    }));
    const list = document.createElement("div");
    list.innerHTML = await renderWishlistPage();
    const cards = list.querySelectorAll("article");
    expect(cards).toHaveLength(2);
    for (const [index, gift, amount] of [[0, externalItem, 52800], [1, second, 26400]] as const) {
      expect(cards[index].textContent).toContain(formatPrice(amount));
      expect(cards[index].textContent).not.toContain(formatPrice(gift.price!));
      expect(await renderItemPage(gift.id)).toContain(formatPrice(amount));
    }
  });

  it("does not read estimates for a restricted wishlist", async () => {
    vi.stubEnv("GIFT_PRICING_V1_ENABLED", "true");
    mockedGetSharedWishlist.mockResolvedValue({
      user: null,
      wishlist: null,
      status: "restricted",
    });
    expect(await renderWishlistPage()).toContain("This wishlist is private");
    expect(getLinkedGiftEstimate).not.toHaveBeenCalled();
  });
});

describe("Linked gift pricing rollout", () => {
  it("renders a clearly nonpayable estimate without changing external buying", async () => {
    vi.stubEnv("GIFT_PRICING_V1_ENABLED", "true");
    vi.mocked(getLinkedGiftEstimate).mockResolvedValue({ ...unavailableEstimate(), state: "estimate", gift_price_ngn: "111" });
    const markup = await renderItemPage("item-external");
    expect(markup).toContain("Gift estimate");
    expect(markup).toContain("Delivery awaits confirmation");
    expect(markup).toContain("Buy this gift");
    expect(markup).not.toContain("48,000");
  });
  it("never reads or renders an estimate when the owner hides prices", async () => {
    vi.stubEnv("GIFT_PRICING_V1_ENABLED", "true");
    mockedGetSharedWishlist.mockResolvedValue({ user: null, wishlist: { ...wishlist([externalItem]), prices_visible: false }, status: "ok" });
    const markup = await renderItemPage("item-external");
    expect(getLinkedGiftEstimate).not.toHaveBeenCalled();
    expect(markup).not.toContain("Gift estimate");
    expect(markup).not.toContain("48,000");
  });
  it("leaves catalog gifts on their existing path", async () => {
    vi.stubEnv("GIFT_PRICING_V1_ENABLED", "true");
    const markup = await renderItemPage("item-catalog");
    expect(getLinkedGiftEstimate).not.toHaveBeenCalled();
    expect(markup).toContain("48,000");
  });
});

describe("Shared wishlist gift path", () => {
  it("renders without the cart provider, because a gift never enters the cart", async () => {
    const page = await SharedWishlistItemPage({
      params: Promise.resolve({ id: SHARE_ID, itemId: "item-catalog" }),
    });

    // Buying a gift used to go through the shared cart, with the wishlist
    // association kept in localStorage. It now has its own checkout route
    // and the association is derived from the buyer's claim on the server,
    // so this page no longer depends on CartProvider at all (spec 0002,
    // AC-38).
    expect(() =>
      renderToStaticMarkup(createElement(ToastProvider, null, page))
    ).not.toThrow();
  });
});

describe("Shared wishlist estimate concurrency", () => {
  it("limits concurrent lookups while retaining every item's estimate", async () => {
    vi.stubEnv("GIFT_PRICING_V1_ENABLED", "true");
    const gifts = Array.from({ length: 11 }, (_, index) => ({
      ...externalItem,
      id: `external-${index}`,
      title: `Gift ${index}`,
    }));
    mockedGetSharedWishlist.mockResolvedValue({
      user: null,
      wishlist: wishlist(gifts),
      status: "ok",
    });
    let active = 0;
    let peak = 0;
    vi.mocked(getLinkedGiftEstimate).mockImplementation(async (itemId) => {
      active += 1;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active -= 1;
      const index = gifts.findIndex((gift) => gift.id === itemId);
      // Covers AC-17: one unavailable estimate does not hide other gifts.
      return index === 5 ? unavailableEstimate() : {
        ...unavailableEstimate(),
        state: "estimate",
        gift_price_ngn: String(1000 + index),
      };
    });

    const list = document.createElement("div");
    list.innerHTML = await renderWishlistPage();

    expect(peak).toBeLessThanOrEqual(4);
    expect(active).toBe(0);
    expect(getLinkedGiftEstimate).toHaveBeenCalledTimes(gifts.length);
    const cards = list.querySelectorAll("article");
    expect(cards).toHaveLength(gifts.length);
    for (const [index, gift] of gifts.entries()) {
      expect(cards[index].textContent).toContain(gift.title);
      expect(cards[index].textContent).toContain(
        index === 5 ? "Gift pricing is unavailable" : formatPrice(1000 + index),
      );
    }
  });

  it("does not start estimate lookups for an empty wishlist", async () => {
    vi.stubEnv("GIFT_PRICING_V1_ENABLED", "true");
    mockedGetSharedWishlist.mockResolvedValue({
      user: null,
      wishlist: wishlist([]),
      status: "ok",
    });

    await renderWishlistPage();

    expect(getLinkedGiftEstimate).not.toHaveBeenCalled();
  });
});
