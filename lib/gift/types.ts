/** Domain types for the authenticated gifting journey (spec 0002). */

export type IntendedAction = "reserve" | "buy";

export type ClaimState =
  | "reserved"
  | "checking_out"
  | "purchased"
  | "released"
  | "expired";

export interface ActiveClaim {
  claim_id: string;
  wishlist_id: string;
  wishlist_item_id: string;
  state: ClaimState;
  reserved_at: string;
  expires_at: string;
}

/**
 * Every way a resume can end. The page renders one screen per outcome, so
 * keeping them as a closed union is what stops a new failure mode
 * silently falling through to a blank page.
 */
export type ResumeOutcome =
  | "ready"
  | "claimed"
  | "consumed"
  | "expired"
  | "cancelled"
  | "not_found"
  | "account_mismatch"
  | "already_reserved"
  | "already_purchased"
  | "too_many_claims"
  | "external_origin"
  | "not_available";

export interface ResolvedIntent {
  outcome: ResumeOutcome;
  intent_id?: string;
  wishlist_id?: string;
  wishlist_item_id?: string;
  catalog_product_id?: string;
  combination_key?: string | null;
  selected_options?: Record<string, string> | null;
  intended_action?: IntendedAction;
  claim_id?: string;
  state?: ClaimState;
  expires_at?: string;
  replayed?: boolean;
}

export interface GiftCheckoutContext {
  wishlist_id: string;
  wishlist_item_id: string;
  claim_id: string;
  claim_expires_at: string;
  catalog_product_id: string;
  combination_key: string | null;
  product_title: string;
  product_image_url: string | null;
  /** Server authoritative, in Naira. A client submitted price never charges. */
  unit_price: number;
  recipient_first_name: string | null;
  recipient_city: string | null;
  recipient_state: string | null;
  has_destination: boolean;
}
