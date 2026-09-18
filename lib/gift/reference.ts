import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The opaque continuation reference.
 *
 * The raw value is the only purchase related thing the browser ever holds.
 * It carries no wishlist, item, product, variant or price, so there is
 * nothing in it to forge; its entire power is to resume one purchase of a
 * publicly viewable gift, once, within its expiry window.
 *
 * Only the SHA-256 is stored. A database read therefore cannot resume
 * somebody else's journey, which is the same reasoning applied to the
 * existing password reset and invite tokens elsewhere in this product.
 */

const REFERENCE_BYTES = 32;

export function createPurchaseReference() {
  return randomBytes(REFERENCE_BYTES).toString("base64url");
}

export function hashPurchaseReference(reference: string) {
  return createHash("sha256").update(reference).digest("hex");
}

/**
 * Shape check before the value ever reaches the database. A cookie a
 * visitor edited by hand is rejected here rather than becoming a wasted
 * query, and the bound is what stops an oversized value being hashed.
 */
export function isWellFormedReference(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 32 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

/** Constant time comparison, for the rare places two references are compared directly. */
export function referencesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
