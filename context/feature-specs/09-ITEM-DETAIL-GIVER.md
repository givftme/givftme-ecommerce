# Feature: Item Detail (Giver View) & Intent Flag

> **Status note (2026-07-31):** This feature was already shipped under migration 006 ("sharing and giver flow") before this file was reconciled — `app/w/[id]/item/[itemId]/page.tsx`, `app/w/[id]/confirm/[itemId]/page.tsx`, `app/w/[id]/success/[itemId]/page.tsx`, `GiverItemActions.tsx`, `PurchaseConfirmationClient.tsx`, `GiftClaimedSuccess.tsx`, and the `flag-intent` API route. Per [[feedback-spec-vs-architecture-precedence]], this pass audited the shipped code against this spec and fixed real bugs / closed real gaps rather than rewriting working, differently-worded design choices. Real bugs fixed (`gifvtme_migration_014_intent_flag_fixes.sql` plus `route.ts`, `GiverItemActions.tsx`): the intent-flag RPC never allowed a second giver to (re)flag once any flag existed, even past the 24h expiry the rest of the app already enforced at read time — now expiry-aware; "someone else already flagged this" was a hard error instead of the spec's soft 200 + amber "Buy anyway" state; flagging a purchased item returned 404 instead of 409; the UI couldn't tell "you flagged this" from "someone else did," so the Remove/clear-flag control (the DELETE endpoint) was dead code; the intent-flag section wasn't hidden for the wishlist owner viewing their own item. Also fixed a functionally broken catalog purchase flow: "Add to cart" linked to `/checkout?item=...`, a param checkout never read, so the item was never added to cart or associated with the resulting order — checkout never marked it purchased. It's now a real variant-aware add-to-cart wired through to `/api/checkout`'s existing (previously unused) `wishlist_item_id` handling. Cosmetic-only divergences (CTA copy, back-link style, badge wording, analytics event names, the external-purchase confirm bridge) were left as shipped — this file documents shipped reality, not a build target.

## Overview
The item detail page a giver sees after clicking an item on a shared wishlist. Shows full product information and a clear purchase CTA. Branches by `origin`: external items show an affiliate redirect CTA ("Buy on [retailer]"), catalog items show an add-to-cart CTA ("Add to cart"). Includes a soft "I'm planning to buy this" intent flag to reduce accidental duplicate purchases before a hard purchase record exists.

---

## Goals
- Give givers all the information needed to decide and act.
- Branch correctly by item origin — never mix the two purchase flows.
- Provide an intent flag so multiple givers coordinating on a list can signal intent without committing.
- Prompt unauthenticated givers to sign in before proceeding to purchase.

---

## User Stories
- As a giver, I see full item details — image, title, description, price, retailer.
- As a giver viewing an external item, clicking "Buy" takes me to the retailer with tracking applied.
- As a giver viewing a catalog item, clicking "Add to cart" adds it to my cart.
- As a giver, I can flag "I'm planning to buy this" to signal intent to other givers.
- As a giver, I see when someone else has flagged intent on an item.
- As an unauthenticated giver, I am prompted to sign in before flagging intent or purchasing.

---

## Functional Requirements
1. Route: `/w/[id]/item/[itemId]` (`app/w/[id]/item/[itemId]/page.tsx`).
2. The `[id]` segment resolves the wishlist access the same way as the shared wishlist view (`getSharedWishlist()`, see `08-SHARED-WISHLIST-VIEW.md`).
3. If item status is `purchased`: the page shows a "This gift has already been claimed" muted state with a `ClaimedBadge` — no purchase CTAs, `GiverItemActions` isn't even rendered.
4. **External items:** primary CTA is "Buy this gift" (not "Buy on [Retailer]" — the retailer domain is shown as a caption under the button instead, e.g. "Opens jumia.com.ng in a new tab"). Clicking opens `affiliate_url`/`product_url` (with UTM params appended when there's no dedicated affiliate URL) in a new tab, then shows an inline "Once you've bought it on {domain}, come back and confirm" panel with a single "I bought it" link to `/w/[id]/confirm/[itemId]` — there's no separate "No, not yet" dismiss button, since the panel doesn't block the rest of the page.
5. **Catalog items:** primary CTA is "Add to cart." The page fetches the live Sanity product (`PRODUCT_BY_ID_QUERY`, by `catalog_product_id`) server-side; if it comes back null (deleted, or `status != "active"`) or the wishlist-level `catalog_unavailable` check already flagged it, the CTA area shows "No longer available" instead. If the product has variants, `VariantSelector` (the same component the catalog PDP uses) renders and the CTA stays disabled until a valid, in-stock combination is selected. On click, the item is added to the shared cart (`useCart().addItem`) with the resolved price/variant, and a small localStorage marker (`lib/checkout/pendingWishlistItem.ts`) records the wishlist-item association so checkout can pick it up later (see Backend Logic).
6. Intent flag: "I'm planning to buy this" ghost button. `POST /api/wishlists/items/[itemId]/flag-intent` sets `intent_flagged_by`/`intent_flagged_at`. If another user's flag is active and less than 24h old, the response is a 200 `{ warning: 'already_flagged', flagged_at }` rather than an error, and the UI shows an amber "Someone else is planning to buy this" chip with a "Buy anyway" link that reveals the purchase CTAs again (they're hidden by default while someone else's flag is active).
7. Intent flag is per-item, not per-user. A second user can only overwrite an existing flag once it's absent, theirs, or more than 24h old (`gifvtme_migration_014_intent_flag_fixes.sql`) — expiring last-write-wins, matching the read-time expiry `lib/wishlist/shared.ts` already applied to the flag shown on the shared wishlist list view.
8. Only one active (non-expired) intent flag exists per item at a time — a soft signal, not a hard lock. The flagger can clear their own flag via the "Remove" link (`DELETE .../flag-intent`), which no-ops silently if the flag has since changed hands.
9. Giver must be authenticated to flag intent or purchase — `AuthGateSheet` opens with a `redirect` back to the item detail page on any unauthenticated attempt (flag, buy, or add-to-cart).

---

## Non-Functional Requirements
- This page is server-rendered (`export const dynamic = "force-dynamic"`) — same as the shared wishlist view.
- Variant selection and all purchase/intent-flag interactivity live in client components (`GiverItemActions.tsx`); the surrounding page shell is a server component.

---

## UI Requirements

### Route: `/w/[id]/item/[itemId]`

**Back navigation:** an icon-only arrow button to `/w/[id]` (not a "← Back to [Receiver]'s wishlist" text link).

**Item display:**
- Large product image (16:9, full width) with a `Gift` icon placeholder when missing
- Title (h1)
- Price (if `prices_visible=true` and `price > 0`) — `formatPrice()`
- Description/notes (if present) — rendered as plain text below the "Limited" tag
- Origin context: a badge over the image reading "Gifvtme store" (catalog) or "From {domain}" (external) — not the spec's original "Available on [retailer domain]" / "Sold by Gifvtme" wording

**Catalog-only: Variant selector**
- Rendered via the shared `VariantSelector` component when `product.hasVariants`
- Invalid/sold-out combinations are disabled/greyed out (existing `VariantSelector` behavior, reused as-is from the catalog PDP)
- "Add to cart" is disabled until a valid, in-stock variant is selected

**Purchase CTA section:**

*External item:*
- Primary CTA: "Buy this gift" (filled, full width) — opens the affiliate/product URL in a new tab
- After clicking: an inline panel appears — "Once you've bought it on {domain}, come back and confirm below." with an "I bought it" link to `/w/[id]/confirm/[itemId]`

*Catalog item:*
- Primary CTA: "Add to cart" (filled, full width) — disabled until a valid variant is selected (if applicable) or the product is unavailable
- On click: item added to cart, button shows "Added ✓" for ~900ms, then becomes a "View cart" link to `/cart`

**Intent flag section (below CTAs):**
- If no active flag: "I'm planning to buy this" (ghost button)
- If the current viewer holds the flag: "✓ You've marked this as planned." with a "Remove" link
- If someone else holds an active (<24h) flag: amber chip "Someone else is planning to buy this." with a "Buy anyway" link — clicking it reveals the CTA section above, which is otherwise hidden
- Hidden entirely when the viewer is the wishlist owner (`wishlist.viewer_is_owner`)

**Status section:**
- If `purchased`: the page (not `GiverItemActions`) renders a `ClaimedBadge` next to the title plus a muted "This gift has already been claimed, so the buy action is no longer available" box — no purchase CTAs.

---

## Backend Logic

### Flag intent
```
POST /api/wishlists/items/[itemId]/flag-intent

1. Auth check (401 if missing).
2. RPC gifvtme_flag_wishlist_item_intent(p_item_id) — migration 014:
   - not_found (404) if the item doesn't exist or isn't readable by the caller.
   - already_purchased (409) if item.status = 'purchased'.
   - not_available (409) if the item exists but isn't 'available' for another reason.
   - If another user holds an active flag < 24h old: returns 200 with
     { warning: 'already_flagged', flagged_at } — no DB write.
   - Otherwise: sets intent_flagged_by = auth.uid(), intent_flagged_at = now(),
     returns { flagged: true }.
```

### Clear intent flag
```
DELETE /api/wishlists/items/[itemId]/flag-intent

1. Auth check (401 if missing).
2. RPC gifvtme_clear_wishlist_item_intent(p_item_id) — clears the flag only
   when auth.uid() = intent_flagged_by; silent no-op otherwise (matches this
   spec's own Error Handling guidance below — "just refresh").
3. Always returns { cleared: true }.
```

### Catalog checkout association (not in the original spec, added to close the add-to-cart gap)
```
1. GiverItemActions adds the item to the shared client-side cart via useCart().addItem(),
   using price/variant data from the server-fetched Sanity product.
2. setPendingWishlistItem({ wishlistItemId, catalogProductId }) records the association
   in localStorage (lib/checkout/pendingWishlistItem.ts) — needed because the cart page
   and /checkout don't otherwise know which cart line, if any, corresponds to a wishlist item.
3. CheckoutForm reads the marker on hydration, verifies the referenced catalog_product_id
   is still present in the cart, and if so includes wishlist_item_id in the POST /api/checkout
   body (which already validated and stored this field server-side — see API_ROUTES.md).
4. On successful order creation, the marker is cleared. The Flutterwave webhook marks the
   linked wishlist_items row (and any master_items row) purchased on payment confirmation,
   same as any other catalog order.
```

### Variant resolution (client-side)
Matching logic lives inline in `GiverItemActions.tsx` (not a standalone `buildCombinationKey` export) — given a product's attributes/variants from Sanity, it finds the variant whose `options` satisfy every currently-selected attribute value. Functionally equivalent to the catalog PDP's variant matching in `ProductDetail.tsx`.

---

## Database Changes
Intent flag fields on `wishlist_items` (added by **migration 006**, not migration 003 as the original spec guessed):
```sql
ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS intent_flagged_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS intent_flagged_at TIMESTAMPTZ;
```
`gifvtme_migration_014_intent_flag_fixes.sql` replaces `gifvtme_flag_wishlist_item_intent()` to add the 24h-expiry-aware overwrite and purchased/not-found distinction described above. No new tables or columns.

---

## API Endpoints

### `POST /api/wishlists/items/[itemId]/flag-intent`
**Auth:** required.
**Body:** none.
**Response:**
```typescript
{ flagged: true } // success — flag set to the caller
{ warning: "already_flagged", flagged_at: string } // 200 — someone else's active flag stands
{ error: "This item has already been purchased." } // 409
{ error: "This item doesn't exist or was removed." } // 404
```

### `DELETE /api/wishlists/items/[itemId]/flag-intent`
**Auth:** required.
**Response:** always `{ cleared: true }` — clears only when the caller owns the flag, silent no-op otherwise.

See `API_ROUTES.md` for the checkout-side `wishlist_item_id` contract used by the catalog add-to-cart flow.

---

## Permissions and Authorization
- Viewing item detail: same access control as the parent shared wishlist.
- Flagging intent: requires auth. No restriction on who can flag (any viewer) — except the intent-flag section is hidden entirely for the wishlist owner viewing their own item.
- Clearing intent: only the user who set the flag can clear it (`intent_flagged_by = auth.uid()`).

---

## Validation
No form fields. Intent flag is a toggle action. Catalog variant selection is validated client-side (via `VariantSelector`'s availability check) before the "Add to cart" CTA is enabled.

---

## Error Handling

| Scenario | Response |
|---|---|
| Item not found | 404 — "This item doesn't exist or was removed." |
| Item already purchased | Page shows the claimed state — no CTAs rendered at all |
| Flag intent on purchased item | 409 — "This item has already been purchased." |
| Clear flag: not your flag | Silent no-op, `{ cleared: true }` — matches this spec's own guidance to just refresh rather than surface an error |
| Variant not in stock | Greyed out / disabled in `VariantSelector`, plus a "This combination is currently unavailable" message |
| Catalog product deleted/inactive | "No longer available" shown in place of the CTA |

---

## Loading and Empty States
- **Page load:** server-rendered, no skeleton.
- **Flagging intent:** the button shows a spinner while the request is in flight.
- **Add to cart:** button shows "Added ✓" for ~900ms, then becomes "View cart".
- **Missing product image:** `Gift` icon placeholder.

---

## Edge Cases

1. **Two givers race to flag intent simultaneously.** Whichever request the DB processes second either overwrites (if the first flag is now >24h old or belongs to the same user) or receives the `already_flagged` warning (if the first flag is still active and belongs to someone else) — no true last-write-wins race exists post-fix, since a fresh flag can only be taken, never silently clobbered, while still active.

2. **Giver flags intent, then the item gets purchased by someone else before they complete the purchase.** The item's `status` flips to `purchased`; a stale page view still shows the old (non-claimed) state until refreshed/revalidated, at which point the page renders the claimed state instead of `GiverItemActions`. `/api/checkout`'s `validateWishlistItem` also independently rejects a checkout attempt against a no-longer-`available` wishlist item with 409.

3. **External item's URL was removed from the retailer's site.** Unchanged from the original spec — Gifvtme can't detect this; the giver lands on the retailer's own 404.

4. **Catalog item with no variants.** `catalogProduct.hasVariants` is `false`, so `VariantSelector` isn't rendered and "Add to cart" is active as soon as a price resolves.

5. **Giver is the receiver viewing their own shared link.** The intent-flag section is hidden via `wishlist.viewer_is_owner` (checked in `GiverItemActions`'s `isOwner` prop). The purchase CTAs themselves are not hidden for the owner — out of scope for this pass, not flagged as a bug.

6. **Price changed (flash sale) between page load and CTA click.** External items: irrelevant, price is display-only. Catalog items: `/api/checkout` re-fetches the authoritative Sanity price at submit time regardless of what was added to cart — the client-submitted `display_price` is validation-only, never trusted.

---

## Analytics / Events
Shipped event names differ from the spec's `item_detail.*` proposal — they follow this codebase's existing `shared_wishlist.*` / `purchase.*` convention instead (see `08-SHARED-WISHLIST-VIEW.md`, `07-WISHLIST-SHARING.md`):
- `shared_wishlist.item.viewed` (origin, status)
- `shared_wishlist.item.buy_tapped` / `purchase.external.redirect` (external)
- `shared_wishlist.item.add_to_cart` (catalog, has_variant)
- `shared_wishlist.intent_flagged`
- `shared_wishlist.intent_cleared`
- `shared_wishlist.intent_warning_seen`
- `shared_wishlist.buy_anyway_clicked`

---

## Testing Requirements

### Unit tests
- `app/api/wishlists/items/[itemId]/flag-intent/route.test.ts` — covers the 401/404/409 mappings, the `{ flagged: true }` success shape, the `already_flagged` 200-warning shape, and DELETE's always-`{ cleared: true }` response.
- No standalone `buildCombinationKey` unit test exists — the variant-matching logic is inline in `GiverItemActions.tsx`, mirroring the equivalent (also untested) logic in `ProductDetail.tsx`.

### Integration tests
Not present for the confirm/purchase/checkout-association flow — flagged as a gap, not closed this pass (out of scope; would need Supabase/Flutterwave test doubles beyond what this session set up).

### Manual QA
- Click "Buy this gift" on an external item — verify the URL opens in a new tab and the confirm panel appears.
- Flag intent as one user, then attempt to flag as a second user within 24h — verify the second user sees the amber "Buy anyway" state instead of an error, and clicking "Buy anyway" reveals the CTA again.
- Wait past 24h (or adjust `intent_flagged_at` directly) — verify a second user can now flag normally.
- Add a catalog item with variants to cart, selecting an invalid combination — verify "Add to cart" stays disabled and the unavailable message shows.
- Complete a catalog checkout from an item-detail "Add to cart" — verify the resulting order has `wishlist_item_id` set and the wishlist item flips to `purchased` after the Flutterwave webhook fires.

---

## Acceptance Criteria
- [x] External items show an affiliate redirect CTA; catalog items show an "Add to cart" CTA.
- [x] Claimed items show the claimed state with no purchase CTAs.
- [x] Intent flagging sets the correct DB fields and shows the amber warning chip to other viewers.
- [x] An intent flag older than 24 hours is not displayed, and no longer permanently blocks re-flagging.
- [x] Only the user who set a flag can clear it.
- [x] Catalog items with variants require a valid variant selection before the cart CTA is active.
- [x] Unauthenticated givers are redirected to login before they can flag intent or purchase.

---

## Future Improvements
- Real-time intent flag updates (Supabase realtime — another giver flags while you're on the page).
- "Notify me when this is available again" for claimed items (for future re-gifting).
- Giver gifting notes ("From all of us at work" — attached to the purchase for the receiver to see).
- Integration test coverage for the confirm/purchase/checkout-association flow.
- Consider hiding purchase CTAs (not just the intent-flag section) for the wishlist owner viewing their own item.
