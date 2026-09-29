import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));
import { candidateSourceAmount, estimateCandidate, type CandidatePriceSource } from "./estimate";

const source: CandidatePriceSource = { source_price: "100.50", source_currency: "NGN",
  converted_price_ngn: 101, fx_rate: null, fx_rate_source: null, fx_as_of: null };

describe("safe linked gift estimates", () => {
  it("uses the raw native amount, not the previously rounded conversion", () => {
    expect(candidateSourceAmount(source)).toBe("100.50");
    expect(estimateCandidate(source, 1000)).toMatchObject({ state: "estimate", gift_price_ngn: "111", total_ngn: null, delivery_ngn: null, payment_availability: "unavailable" });
  });
  it("distinguishes an unset rate from published zero", () => {
    expect(estimateCandidate(source, null)).toMatchObject({ state: "pricing_unavailable", gift_price_ngn: null });
    expect(estimateCandidate(source, 0)).toMatchObject({ state: "estimate", gift_price_ngn: "101" });
  });
  it("never treats unconverted foreign currency as Naira", () => {
    const foreign = { ...source, source_currency: "USD" };
    expect(estimateCandidate(foreign, 1000).state).toBe("pricing_unavailable");
    expect(estimateCandidate({ ...foreign, converted_price_ngn: 150000, fx_rate: 1500, fx_rate_source: "fixture", fx_as_of: "2026-09-28" }, 1000).gift_price_ngn).toBe("165000");
  });
  it("withholds supplier amounts, policy rate and evidence", () => {
    const projection = estimateCandidate(source, 1000);
    expect(projection).not.toHaveProperty("source_price");
    expect(projection).not.toHaveProperty("rate_bps");
    expect(projection).not.toHaveProperty("fx_rate_source");
  });
});
