import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/gift-museum/fx", () => ({ convertToNgn: vi.fn() }));
import { createServiceClient } from "@/lib/supabase/server";
import { convertToNgn } from "./fx";
import { upsertGiftMuseumCandidateForWishlistItem } from "./candidates";

type Row = Record<string, unknown>;
function fixture(status = "pending") {
  let candidate: Row = { id: "shared-candidate", status, demand_count: 1, title: "Gift",
    source_price: 50, source_currency: "USD", converted_price_ngn: 75000,
    fx_rate: 1500, fx_rate_source: "older-conversion", fx_as_of: "2026-09-28" };
  const links = new Map<string, Row>();
  const upsert = vi.fn(async (row: Row) => { links.set(String(row.wishlist_item_id), row); return { error: null }; });
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: candidate, error: null }),
    update: (data: Row) => { candidate = { ...candidate, ...data }; return query; },
    single: async () => ({ data: candidate, error: null }),
  };
  const db = { from: (table: string) => table === "gift_museum_candidates" ? query : { upsert } } as unknown as SupabaseClient;
  vi.mocked(createServiceClient).mockReturnValue(db);
  return { links, candidate: () => candidate };
}

const input = { userId: "owner-a", originalUrl: "https://shop.example/gift", title: "Gift", sourceCurrency: "NGN" };
beforeEach(() => { vi.clearAllMocks(); });

describe("candidate intake source evidence", () => {
  it("keeps separate amounts on links when the shared candidate is refreshed", async () => {
    const { links, candidate } = fixture();
    vi.mocked(convertToNgn).mockImplementation(async (_db, amount) => ({
      convertedPriceNgn: Math.round(amount!), rate: 1, source: "native-ngn", asOf: "2026-09-29",
    }));
    await upsertGiftMuseumCandidateForWishlistItem({ ...input, wishlistItemId: "item-a", sourcePrice: 100.5 });
    await upsertGiftMuseumCandidateForWishlistItem({ ...input, userId: "owner-b", wishlistItemId: "item-b", sourcePrice: 200.5 });
    expect(candidate().source_price).toBe(200.5);
    expect(links.get("item-a")).toMatchObject({ candidate_id: "shared-candidate", source_price: 100.5, source_currency: "NGN", converted_price_ngn: 101 });
    expect(links.get("item-b")).toMatchObject({ candidate_id: "shared-candidate", source_price: 200.5, source_currency: "NGN", converted_price_ngn: 201 });
  });

  it("records this intake's source even when approved candidate fields are retained", async () => {
    const { links, candidate } = fixture("approved");
    vi.mocked(convertToNgn).mockResolvedValue({ convertedPriceNgn: 101, rate: 1, source: "native-ngn", asOf: "2026-09-29" });
    await upsertGiftMuseumCandidateForWishlistItem({ ...input, wishlistItemId: "item-a", sourcePrice: 100.5 });
    expect(candidate().source_currency).toBe("USD");
    expect(links.get("item-a")).toMatchObject({ source_price: 100.5, source_currency: "NGN", fx_rate: 1, fx_rate_source: "native-ngn" });
  });

  it("clears conversion evidence on this link when its own conversion fails", async () => {
    const { links } = fixture();
    vi.mocked(convertToNgn).mockResolvedValueOnce({ convertedPriceNgn: 150000, rate: 1500, source: "fixture", asOf: "2026-09-29" });
    await upsertGiftMuseumCandidateForWishlistItem({ ...input, wishlistItemId: "item-a", sourcePrice: 100, sourceCurrency: "USD" });
    vi.mocked(convertToNgn).mockResolvedValueOnce(null);
    await upsertGiftMuseumCandidateForWishlistItem({ ...input, wishlistItemId: "item-a", sourcePrice: 200, sourceCurrency: "USD" });
    expect(links.get("item-a")).toMatchObject({
      source_price: 200, source_currency: "USD", converted_price_ngn: null,
      fx_rate: null, fx_rate_source: null, fx_as_of: null,
    });
  });
});
