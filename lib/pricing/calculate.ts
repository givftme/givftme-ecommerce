import { CALCULATION_VERSION, type PricingPolicyKey } from "./types";

const ZERO = BigInt(0);
const MAX_WHOLE = BigInt("99999999999999");

// Monetary API inputs are decimal strings. All arithmetic stays scaled and exact.
export function parseAmount(value: string, decimals: 0 | 2): bigint {
  const pattern = decimals === 2 ? /^(0|[1-9]\d{0,11})(\.\d{1,2})?$/ : /^(0|[1-9]\d{0,13})$/;
  if (typeof value !== "string" || !pattern.test(value)) throw new Error("invalid_amount");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole + fraction.padEnd(decimals, "0"));
}

export function normalizeSource(value: string): string {
  const amount = parseAmount(value, 2);
  if (amount <= ZERO) throw new Error("invalid_source_amount");
  return `${amount / BigInt(100)}.${(amount % BigInt(100)).toString().padStart(2, "0")}`;
}

export function validateRate(policy: PricingPolicyKey, rateBps: number): void {
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > (policy === "partial_cash_payout" ? 9999 : 50000)) {
    throw new Error("invalid_rate");
  }
}

function whole(value: bigint): string {
  if (value < ZERO || value > MAX_WHOLE) throw new Error("amount_out_of_range");
  return value.toString();
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / BigInt(2)) / denominator;
}

export function calculatePhysical(source: string, rateBps: number, delivery: string | null) {
  validateRate("linked", rateBps);
  const normalizedSource = normalizeSource(source);
  const cents = parseAmount(normalizedSource, 2);
  const unrounded = cents * BigInt(10000 + rateBps);
  const scale = BigInt(1000000);
  const gift = roundHalfUp(unrounded, scale);
  const deliveryAmount = delivery === null ? null : parseAmount(delivery, 0);
  const total = deliveryAmount === null ? null : gift + deliveryAmount;
  if (total !== null && total <= ZERO) throw new Error("invalid_payable_total");
  return {
    calculation_version: CALCULATION_VERSION,
    source_amount_ngn: normalizedSource,
    rate_bps: rateBps,
    gift_price_ngn: whole(gift),
    delivery_ngn: deliveryAmount === null ? null : whole(deliveryAmount),
    total_ngn: total === null ? null : whole(total),
    // Signed millionths of a Naira reconstruct the exact rounding adjustment.
    rounding_adjustment_millionths: (gift * scale - unrounded).toString(),
  };
}

export function calculateCashTarget(recipient: string, rateBps: number) {
  validateRate("manual_cash", rateBps);
  const amount = parseAmount(recipient, 0);
  if (amount <= ZERO) throw new Error("invalid_recipient_amount");
  const fee = roundHalfUp(amount * BigInt(rateBps), BigInt(10000));
  return {
    calculation_version: CALCULATION_VERSION,
    rate_bps: rateBps,
    recipient_ngn: whole(amount),
    cash_fee_ngn: whole(fee),
    total_ngn: whole(amount + fee),
    delivery_ngn: "0",
  };
}

export interface FundsSnapshot {
  verified_receipts_ngn: string;
  completed_refunds_ngn: string;
  reversals_ngn: string;
  available_unallocated_ngn: string;
}

// A calculation grants no payout permission. The owning ledger must reserve its
// reviewed revision and the full required allocation before executing a payout.
export function calculatePartialCashPayout(funds: FundsSnapshot, rateBps: number) {
  validateRate("partial_cash_payout", rateBps);
  const base = parseAmount(funds.verified_receipts_ngn, 0)
    - parseAmount(funds.completed_refunds_ngn, 0) - parseAmount(funds.reversals_ngn, 0);
  if (base < ZERO) throw new Error("invalid_funds_snapshot");
  if (parseAmount(funds.available_unallocated_ngn, 0) < base) throw new Error("insufficient_unallocated_funds");
  const deduction = roundHalfUp(base * BigInt(rateBps), BigInt(10000));
  return {
    calculation_version: CALCULATION_VERSION,
    rate_bps: rateBps,
    confirmed_raised_ngn: whole(base),
    deduction_ngn: whole(deduction),
    recipient_ngn: whole(base - deduction),
    required_allocation_ngn: whole(base),
  };
}
