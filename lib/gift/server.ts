import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CLAIM_CHECKOUT_HOLD_MINUTES,
  CLAIM_RESERVATION_HOURS,
  MAX_ACTIVE_CLAIMS_PER_VISITOR,
  PURCHASE_INTENT_TTL_HOURS,
} from "@/lib/gift/constants";
import { hashPurchaseReference } from "@/lib/gift/reference";
import type {
  ActiveClaim,
  IntendedAction,
  ResolvedIntent,
} from "@/lib/gift/types";

/**
 * Thin, typed wrappers over the gifting RPCs (migrations 026 and 027).
 *
 * Every one of these tables is unreachable from a client policy by design,
 * so these functions are the only way in. Keeping the argument names in
 * one place also keeps them in step with the SQL, which is where the
 * previous intent flag drifted.
 */

interface ClaimResult {
  claim_id: string;
  state: string;
  expires_at: string;
  already_owned: boolean;
}

/**
 * Maps a Postgres error from the claim functions onto the HTTP answer the
 * spec's API surface table specifies. The RPCs raise bare tokens
 * (`already_reserved`, `not_found`) rather than prose so the wording lives
 * here, next to the status code it travels with.
 */
export function claimErrorResponse(message: string | undefined) {
  const text = message ?? "";

  if (text.includes("not_authenticated")) {
    return { status: 401, error: "You need to sign in first." };
  }

  if (text.includes("already_purchased")) {
    return { status: 410, error: "This gift has already been bought." };
  }

  if (text.includes("already_reserved")) {
    return {
      status: 409,
      error: "Someone just picked this one. Have a look at the other gifts.",
    };
  }

  if (text.includes("external_origin")) {
    return { status: 400, error: "External gifts do not use checkout." };
  }

  if (text.includes("too_many_claims")) {
    return {
      status: 429,
      error: `You can hold ${MAX_ACTIVE_CLAIMS_PER_VISITOR} gifts at a time. Buy or release one first.`,
    };
  }

  if (text.includes("not_available")) {
    return { status: 409, error: "This gift is no longer available." };
  }

  return { status: 404, error: "We couldn't find that gift." };
}

export async function claimWishlistItem(
  supabase: SupabaseClient,
  itemId: string
) {
  const { data, error } = await supabase.rpc("gifvtme_claim_wishlist_item", {
    p_item_id: itemId,
    p_reservation_hours: CLAIM_RESERVATION_HOURS,
    p_max_active_claims: MAX_ACTIVE_CLAIMS_PER_VISITOR,
  });

  if (error) {
    return { ok: false as const, ...claimErrorResponse(error.message) };
  }

  return { ok: true as const, claim: data as ClaimResult };
}

export async function releaseWishlistItemClaim(
  supabase: SupabaseClient,
  itemId: string
) {
  const { error } = await supabase.rpc("gifvtme_release_wishlist_item_claim", {
    p_item_id: itemId,
    p_release_reason: "claimant_released",
  });

  if (error) {
    const mapped = claimErrorResponse(error.message);

    // Nothing to release is a 404 rather than a 403: the caller learns
    // only that they hold no claim here, never that somebody else does.
    return { ok: false as const, ...mapped };
  }

  return { ok: true as const };
}

/**
 * The caller's own live claim on an item, or null. This is where the
 * wishlist association for a gift order comes from — never a client
 * supplied id, and never localStorage (spec AC-38).
 */
export async function getActiveClaim(
  supabase: SupabaseClient,
  itemId: string
): Promise<ActiveClaim | null> {
  const { data, error } = await supabase.rpc("gifvtme_get_active_claim", {
    p_item_id: itemId,
  });

  if (error || !data) {
    return null;
  }

  return data as ActiveClaim;
}

/**
 * The claim behind a gift order, found from the caller's session and the
 * catalogue product in their cart. This replaces the client supplied
 * wishlist_item_id that POST /api/checkout used to accept.
 */
export async function getActiveClaimForProduct(
  supabase: SupabaseClient,
  catalogProductId: string
): Promise<ActiveClaim | null> {
  const { data, error } = await supabase.rpc(
    "gifvtme_get_active_claim_for_product",
    { p_catalog_product_id: catalogProductId }
  );

  if (error || !data) {
    return null;
  }

  return data as ActiveClaim;
}

export async function beginGiftCheckout(
  supabase: SupabaseClient,
  itemId: string
) {
  const { data, error } = await supabase.rpc("gifvtme_begin_gift_checkout", {
    p_item_id: itemId,
    p_hold_minutes: CLAIM_CHECKOUT_HOLD_MINUTES,
  });

  if (error) {
    return { ok: false as const, ...claimErrorResponse(error.message) };
  }

  const result = data as {
    outcome: string;
    claim_id?: string;
    wishlist_id?: string;
    state?: string;
    expires_at?: string;
  };

  if (result.outcome === "no_active_claim") {
    return {
      ok: false as const,
      status: 409,
      error: "You don't have this gift reserved.",
    };
  }

  if (result.outcome === "expired") {
    return {
      ok: false as const,
      status: 409,
      error: "Your reservation ran out. Reserve it again to keep going.",
    };
  }

  return { ok: true as const, claim: result };
}

export async function createPurchaseIntent(
  supabase: SupabaseClient,
  input: {
    reference: string;
    itemId: string;
    combinationKey: string | null;
    selectedOptions: Record<string, string> | null;
    intendedAction: IntendedAction;
  }
) {
  const { data, error } = await supabase.rpc("gifvtme_create_purchase_intent", {
    p_reference_hash: hashPurchaseReference(input.reference),
    p_item_id: input.itemId,
    p_combination_key: input.combinationKey,
    p_selected_options: input.selectedOptions,
    p_intended_action: input.intendedAction,
    p_ttl_hours: PURCHASE_INTENT_TTL_HOURS,
  });

  if (error) {
    return { ok: false as const, ...claimErrorResponse(error.message) };
  }

  return {
    ok: true as const,
    intent: data as { intent_id: string; expires_at: string },
  };
}

/** Step one of resume: identify the intent and bind it to the acting account. */
export async function resolvePurchaseIntent(
  supabase: SupabaseClient,
  reference: string
): Promise<ResolvedIntent> {
  const { data, error } = await supabase.rpc("gifvtme_resolve_purchase_intent", {
    p_reference_hash: hashPurchaseReference(reference),
  });

  if (error || !data) {
    return { outcome: "not_found" };
  }

  return data as ResolvedIntent;
}

/** Step two of resume: create the claim and consume the intent, atomically. */
export async function consumePurchaseIntent(
  supabase: SupabaseClient,
  reference: string
): Promise<ResolvedIntent> {
  const { data, error } = await supabase.rpc("gifvtme_consume_purchase_intent", {
    p_reference_hash: hashPurchaseReference(reference),
    p_reservation_hours: CLAIM_RESERVATION_HOURS,
    p_max_active_claims: MAX_ACTIVE_CLAIMS_PER_VISITOR,
  });

  if (error || !data) {
    return { outcome: "not_found" };
  }

  return data as ResolvedIntent;
}
