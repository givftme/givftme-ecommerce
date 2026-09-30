import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));
import { getLinkedGiftEstimate, type CandidatePriceSource } from "./estimate";

type Row = Record<string, unknown>;
const ngn = (price: string): CandidatePriceSource => ({
  source_price: price, source_currency: "NGN", converted_price_ngn: Math.round(Number(price)),
  fx_rate: 1, fx_rate_source: "native-ngn", fx_as_of: "2026-09-29",
});

function fixture() {
  const tables: Record<string, Row[]> = {
    wishlist_items: [
      { id: "item-a", origin: "external", product_url: "https://shop.example/gift", price: "100.50", pricing_revision: 0, active_price_quote_id: null },
      { id: "item-b", origin: "external", product_url: "https://shop.example/gift", price: "200.50", pricing_revision: 0, active_price_quote_id: null },
    ],
    gift_museum_candidate_wishlist_items: [
      { candidate_id: "shared-candidate", wishlist_item_id: "item-a", ...ngn("100.50") },
      { candidate_id: "shared-candidate", wishlist_item_id: "item-b", ...ngn("200.50") },
    ],
    // Intake refreshed the shared candidate with item B's price.
    gift_museum_candidates: [{ id: "shared-candidate", ...ngn("200.50") }],
    gift_pricing_policies: [{ key: "linked", active_version_id: "rate-1" }],
    gift_pricing_rate_versions: [{ id: "rate-1", policy_key: "linked", rate_bps: 1000 }],
  };
  const from = vi.fn((table: string) => {
    let fields = "*";
    const filters: Array<[string, unknown]> = [];
    function rows() {
      return (tables[table] || []).filter(row => filters.every(([key, value]) => row[key] === value))
        .map(row => fields === "*" ? row : Object.fromEntries(fields.split(",").map(key => [key, row[key]])));
    }
    const query = {
      select: (value: string) => { fields = value; return query; },
      eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      limit: async (count: number) => ({ data: rows().slice(0, count), error: null }),
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      single: async () => ({ data: rows()[0] ?? null, error: null }),
    };
    return query;
  });
  return { tables, from, db: { from } as unknown as SupabaseClient };
}

describe("wishlist item source isolation", () => {
  it("prices two items sharing a URL from their own entered amounts", async () => {
    const { db } = fixture();
    expect(await getLinkedGiftEstimate("item-a", db)).toMatchObject({ state: "estimate", gift_price_ngn: "111" });
    expect(await getLinkedGiftEstimate("item-b", db)).toMatchObject({ state: "estimate", gift_price_ngn: "221" });
  });

  it("keeps estimates independent of later shared candidate price and currency refreshes", async () => {
    const { db, tables, from } = fixture();
    Object.assign(tables.gift_museum_candidates[0], { ...ngn("900"), source_currency: "USD", converted_price_ngn: 1350000, fx_rate: 1500 });
    expect(await getLinkedGiftEstimate("item-a", db)).toMatchObject({ gift_price_ngn: "111" });
    expect(from).not.toHaveBeenCalledWith("gift_museum_candidates");
  });

  it("uses the item's current NGN price after an owner edits it", async () => {
    const { db, tables } = fixture();
    tables.wishlist_items[0].price = "300.50";
    expect(await getLinkedGiftEstimate("item-a", db)).toMatchObject({ gift_price_ngn: "331" });
  });

  it("never fills a cleared item price from a candidate", async () => {
    const { db, tables } = fixture();
    tables.wishlist_items[0].price = null;
    expect(await getLinkedGiftEstimate("item-a", db)).toMatchObject({ state: "pricing_unavailable", gift_price_ngn: null });
  });

  it("does not guess provenance for legacy links", async () => {
    const { db, tables } = fixture();
    tables.gift_museum_candidate_wishlist_items[0] = { candidate_id: "shared-candidate", wishlist_item_id: "item-a", source_currency: null };
    expect(await getLinkedGiftEstimate("item-a", db)).toMatchObject({ state: "pricing_unavailable" });
  });

  it("uses only the foreign conversion recorded for this item's exact source amount", async () => {
    const { db, tables } = fixture();
    Object.assign(tables.gift_museum_candidate_wishlist_items[0], {
      source_currency: "USD", converted_price_ngn: 150750, fx_rate: 1500, fx_rate_source: "fixture",
    });
    expect(await getLinkedGiftEstimate("item-a", db)).toMatchObject({ gift_price_ngn: "165825" });
    tables.wishlist_items[0].price = "101";
    expect(await getLinkedGiftEstimate("item-a", db)).toMatchObject({ state: "pricing_unavailable" });
  });

  it("does not borrow another item's successful conversion when this one failed", async () => {
    const { db, tables } = fixture();
    Object.assign(tables.gift_museum_candidate_wishlist_items[0], {
      source_currency: "USD", converted_price_ngn: null, fx_rate: null, fx_rate_source: null, fx_as_of: null,
    });
    expect(await getLinkedGiftEstimate("item-a", db)).toMatchObject({ state: "pricing_unavailable" });
  });
});
