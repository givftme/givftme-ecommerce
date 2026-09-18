/**
 * Configuration for the authenticated gifting journey (spec 0002).
 *
 * Every value here is read once at module load with a documented default,
 * so a missing variable degrades to the spec's stated default rather than
 * failing a purchase. The two clock values exist as configuration
 * specifically because the old intent flag hardcoded 24 hours in two
 * places that then disagreed; keep them in one place.
 */

function readPositiveInt(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** How long a signed out visitor has to finish signing up. */
export const PURCHASE_INTENT_TTL_HOURS = readPositiveInt(
  process.env.PURCHASE_INTENT_TTL_HOURS,
  24
);

/** How long consumed, expired and cancelled intents are kept before deletion. */
export const PURCHASE_INTENT_RETENTION_DAYS = readPositiveInt(
  process.env.PURCHASE_INTENT_RETENTION_DAYS,
  7
);

/** Active claims one account may hold at once, across all wishlists. */
export const MAX_ACTIVE_CLAIMS_PER_VISITOR = readPositiveInt(
  process.env.MAX_ACTIVE_CLAIMS_PER_VISITOR,
  5
);

/** Intent creations allowed per IP per hour. The one thing a signed out visitor can do. */
export const MAX_INTENTS_PER_IP_PER_HOUR = readPositiveInt(
  process.env.MAX_INTENTS_PER_IP_PER_HOUR,
  30
);

/** How long a reservation holds an item. */
export const CLAIM_RESERVATION_HOURS = readPositiveInt(
  process.env.CLAIM_RESERVATION_HOURS,
  72
);

/** How long the checkout hold lasts once a buyer opens gift checkout. */
export const CLAIM_CHECKOUT_HOLD_MINUTES = readPositiveInt(
  process.env.CLAIM_CHECKOUT_HOLD_MINUTES,
  60
);

/**
 * SameSite is Lax and not Strict on purpose. Returning from an email
 * confirmation link is a top level navigation from another site, and
 * Strict would drop this cookie at exactly the moment it is needed. See
 * spec 0002 AC-8.
 */
export const PURCHASE_INTENT_COOKIE = "gifvtme_purchase_intent";

export const GIFT_RESUME_PATH = "/gift/resume";
