import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn(), createClient: vi.fn() }));
vi.mock("@/lib/wishlist/shared", () => ({ getSharedWishlist: vi.fn(), getSharedWishlistItem: vi.fn(), isUuidLike: vi.fn().mockReturnValue(true) }));
vi.mock("@/lib/pricing/estimate", () => ({ getLinkedGiftEstimate: vi.fn() }));
import { createServiceClient } from "@/lib/supabase/server";
import { getSharedWishlist, getSharedWishlistItem } from "@/lib/wishlist/shared";
import { getLinkedGiftEstimate } from "@/lib/pricing/estimate";
import { GET } from "./route";

const itemId = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ itemId }) };
const request = new Request("https://gifts.example/api/wishlists/items/" + itemId + "/pricing?amount=1&origin=catalog");
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("GIFT_PRICING_V1_ENABLED", "true");
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { wishlist_id: "stored-list" }, error: null }) };
  vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(query) } as unknown as ReturnType<typeof createServiceClient>);
  vi.mocked(getSharedWishlistItem).mockReturnValue({ id: itemId, origin: "external", product_url: "https://supplier.example/item" } as ReturnType<typeof getSharedWishlistItem>);
});
afterEach(() => vi.unstubAllEnvs());

describe("public pricing access", () => {
  it("returns neutral 404 for unreadable and hidden price wishlists before reading pricing", async () => {
    for (const wishlist of [null, { prices_visible: false }]) {
      vi.mocked(getSharedWishlist).mockResolvedValue({ wishlist } as Awaited<ReturnType<typeof getSharedWishlist>>);
      expect((await GET(request, context)).status).toBe(404);
    }
    expect(getLinkedGiftEstimate).not.toHaveBeenCalled();
  });
  it("uses stored identity, ignores forged client amounts and never caches responses", async () => {
    vi.mocked(getSharedWishlist).mockResolvedValue({ wishlist: { prices_visible: true } } as Awaited<ReturnType<typeof getSharedWishlist>>);
    vi.mocked(getLinkedGiftEstimate).mockResolvedValue({ state: "estimate", gift_price_ngn: "111", total_ngn: null } as Awaited<ReturnType<typeof getLinkedGiftEstimate>>);
    const response = await GET(request, context);
    expect(getSharedWishlist).toHaveBeenCalledWith("stored-list");
    expect(await response.json()).toEqual({ state: "estimate", gift_price_ngn: "111", total_ngn: null });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("does not apply linked markup to a catalog item or expose a disabled rollout", async () => {
    vi.mocked(getSharedWishlist).mockResolvedValue({ wishlist: { prices_visible: true } } as Awaited<ReturnType<typeof getSharedWishlist>>);
    vi.mocked(getSharedWishlistItem).mockReturnValue({ origin: "catalog" } as ReturnType<typeof getSharedWishlistItem>);
    expect((await GET(request, context)).status).toBe(404);
    vi.stubEnv("GIFT_PRICING_V1_ENABLED", "false");
    expect((await GET(request, context)).status).toBe(404);
    expect(getLinkedGiftEstimate).not.toHaveBeenCalled();
  });
});
