import { describe, expect, it } from "vitest";
import { calculateCashTarget, calculatePartialCashPayout, calculatePhysical, parseAmount } from "./calculate";

describe("exact gift pricing", () => {
  it("marks up only the source and adds explicitly confirmed delivery", () => {
    expect(calculatePhysical("10000", 1000, "1500")).toMatchObject({ gift_price_ngn: "11000", total_ngn: "12500" });
  });
  it("preserves source precision before rounding, including halves", () => {
    expect(calculatePhysical("100.50", 1000, "0")).toMatchObject({ gift_price_ngn: "111", rounding_adjustment_millionths: "450000" });
    expect(calculatePhysical("101", 5000, "0").total_ngn).toBe("152");
    expect(calculatePhysical("100.49", 0, "0").total_ngn).toBe("100");
    expect(calculatePhysical("100.50", 0, "0").total_ngn).toBe("101");
  });
  it("keeps unknown delivery and total unavailable", () => {
    expect(calculatePhysical("10000", 0, null)).toMatchObject({ gift_price_ngn: "10000", delivery_ngn: null, total_ngn: null });
  });
  it.each(["-1", "NaN", "Infinity", "1.001", "1e3", "", " 10", "01", "1000000000000"])("rejects invalid source %s", (source) => {
    expect(() => calculatePhysical(source, 1000, "0")).toThrow();
  });
  it("rejects output overflow and fractional delivery without coercion", () => {
    expect(() => calculatePhysical("999999999999.99", 50000, "99999999999999")).toThrow("amount_out_of_range");
    expect(() => calculatePhysical("10", 1000, "0.5")).toThrow();
    expect(() => calculatePhysical("0.01", 0, "0")).toThrow("invalid_payable_total");
    expect(() => parseAmount("1.0", 0)).toThrow();
  });
  it("keeps the desired receipt intact and adds the cash fee", () => {
    expect(calculateCashTarget("10000", 1000)).toMatchObject({ recipient_ngn: "10000", cash_fee_ngn: "1000", total_ngn: "11000", delivery_ngn: "0" });
    expect(calculateCashTarget("1", 1).cash_fee_ngn).toBe("0");
    expect(calculateCashTarget("101", 5000).cash_fee_ngn).toBe("51");
  });
  it("deducts once from net verified receipts, and requires the full balance", () => {
    const funds = { verified_receipts_ngn: "10000", completed_refunds_ngn: "3000", reversals_ngn: "1000", available_unallocated_ngn: "6000" };
    expect(calculatePartialCashPayout(funds, 500)).toMatchObject({ confirmed_raised_ngn: "6000", deduction_ngn: "300", recipient_ngn: "5700", required_allocation_ngn: "6000" });
    expect(() => calculatePartialCashPayout({ ...funds, available_unallocated_ngn: "5700" }, 500)).toThrow("insufficient_unallocated_funds");
    expect(() => calculatePartialCashPayout({ ...funds, completed_refunds_ngn: "10000" }, 500)).toThrow("invalid_funds_snapshot");
    expect(() => calculatePartialCashPayout(funds, 10000)).toThrow("invalid_rate");
  });
});
