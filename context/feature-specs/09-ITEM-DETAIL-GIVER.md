# Feature: Item Detail (Giver View) & Intent Flag

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
1. Route: `/w/[id]/item/[itemId]`.
2. The `[id]` segment resolves the wishlist access (same logic as the shared wishlist view).
3. If item status is `purchased`: show a "This gift has already been claimed" state — no purchase CTAs, just a back link.
4. **External items:** primary CTA is "Buy on [Retailer]" (retailer name extracted from the affiliate URL domain). Clicking opens `affiliate_url` in a new tab, then shows a confirmation prompt (either inline below the button or navigation to `/w/[id]/confirm/[itemId]`).
5. **Catalog items:** primary CTA is "Add to cart". Adds to the client-side cart. If the product has variants, a variant selector is shown before the CTA becomes active.
6. Intent flag: "I'm planning to buy this" button. Sets `intent_flagged_by` and `intent_flagged_at` on the `wishlist_items` row. If another user has flagged intent (and it's < 24 hours old): shows "Someone is planning to buy this" amber chip, with "Buy anyway" option.
7. Intent flag is per-item, not per-user — only one active intent flag at a time. A second user flagging intent overwrites the first.
8. Only one person can have an active intent flag per item simultaneously (soft signal — not a hard lock).
9. Giver must be authenticated to flag intent or purchase (redirect to login with `redirect` param on unauthenticated attempt).

---

## Non-Functional Requirements
- This page must be server-rendered (same as the shared wishlist view) for fast initial load.
- Variant selection (for catalog items) is a client component.

---

## UI Requirements

### Route: `/w/[id]/item/[itemId]`

**Back navigation:** "← Back to [Receiver]'s wishlist" link.

**Item display:**
- Large product image (full width on mobile, 50% on desktop)
- Title (h1)
- Price (if `prices_visible=true`) — `formatPrice()`
- Description/notes (if present)
- Origin context: "Available on [retailer domain]" (external) or "Sold by Gifvtme" (catalog)

**Catalog-only: Variant selector**
- If product has variants: attribute buttons (e.g. Size: S / M / L / XL, Color swatches)
- Invalid combinations are disabled/greyed out
- "Add to cart" CTA is disabled until a valid variant is selected (if variants exist)

**Purchase CTA section:**

*External item:*
- Primary CTA: "Buy on [Retailer]" (filled, full width) — opens `affiliate_url` in new tab
- After clicking: inline prompt appears: "Did you complete your purchase?" with "Yes, I bought it" (filled) and "No, not yet" (ghost) buttons
- "Yes" → navigates to `/w/[id]/confirm/[itemId]`
- "No" → dismisses the prompt, returns to normal item view

*Catalog item:*
- Primary CTA: "Add to cart" (filled, full width) — disabled until variant selected (if applicable)
- On click: item added to cart, button briefly shows "Added ✓", then shows "View cart" secondary CTA

**Intent flag section (below CTAs):**
- If no active intent flag: "I'm planning to buy this" (ghost button, small)
- If current user has flagged: "✓ You've marked this as planned" (muted text, "Remove" link)
- If another user flagged (< 24h): amber chip: "Someone else is planning to buy this" + "Buy anyway" link that reveals the CTAs again

**Status section:**
- If `purchased`: full-width "Claimed" banner, remove all purchase CTAs, show "Someone already got this gift! 🎁"

---

## Backend Logic

### Flag intent
```
POST /api/wishlists/items/[itemId]/flag-intent

1. Auth check.
2. Check item status — if 'purchased', return 409 with "This item has already been purchased."
3. Check existing flag: SELECT intent_flagged_at FROM wishlist_items WHERE id=$itemId.
4. If flagged within 24h by another user: return 200 with { warning: 'already_flagged', flagged_at: ... }
   (Frontend shows the "Someone else is planning to buy this" UI)
5. Otherwise: UPDATE wishlist_items SET intent_flagged_by=auth.uid(), intent_flagged_at=NOW() WHERE id=$itemId.
6. Return { flagged: true }.
```

### Clear intent flag
```
DELETE /api/wishlists/items/[itemId]/flag-intent

1. Auth check.
2. Verify auth.uid() = intent_flagged_by (can only clear your own flag).
3. UPDATE wishlist_items SET intent_flagged_by=null, intent_flagged_at=null WHERE id=$itemId.
```

### Variant resolution (client-side)
```typescript
// Given a product's attributes and variants from Sanity:
function buildCombinationKey(selectedOptions: Record<string, string>): string {
  // Sort attribute names alphabetically for consistent key
  return Object.keys(selectedOptions).sort()
    .map(k => `${k}:${selectedOptions[k]}`)
    .join('|')
}

// Find the matching variant:
const matchedVariant = product.variants.find(v => v.combinationKey === buildCombinationKey(selected))
```

---

## Database Changes
Intent flag fields on `wishlist_items` (migration 003 — verify):
```sql
ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS intent_flagged_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS intent_flagged_at TIMESTAMPTZ;
```
No additional tables needed.

---

## API Endpoints

### `POST /api/wishlists/items/[itemId]/flag-intent`
**Auth:** required.
**Body:** none.
**Response:**
```typescript
{ flagged: true } // success
{ warning: 'already_flagged', flagged_at: string } // another user has an active flag
{ error: 'already_purchased' } // 409 — item is claimed
```

### `DELETE /api/wishlists/items/[itemId]/flag-intent`
**Auth:** required.
**Response:** `{ cleared: true }` or `{ error: 'not_your_flag' }` (403).

---

## Permissions and Authorization
- Viewing item detail: same access control as the parent shared wishlist.
- Flagging intent: requires auth. No restriction on who can flag (any viewer).
- Clearing intent: only the user who set the flag can clear it (`intent_flagged_by = auth.uid()`).

---

## Validation
No form fields. Intent flag is a toggle action. Catalog variant selection is validated client-side before the "Add to cart" CTA is enabled.

---

## Error Handling

| Scenario | Response |
|---|---|
| Item not found | 404 — "This item doesn't exist or was removed." |
| Item already purchased | Show claimed state — no CTAs |
| Flag intent on purchased item | 409 — toast: "This item has already been purchased" |
| Clear flag: not your flag | 403 — silently ignore (flag may have been overwritten by another user — just refresh) |
| Variant not in stock | "This combination is currently unavailable" — disable that variant option |

---

## Loading and Empty States
- **Page load:** server-rendered, no skeleton needed.
- **Flagging intent:** "I'm planning to buy this" button shows spinner briefly.
- **Add to cart:** button shows "Adding..." then "Added ✓".
- **Missing product image:** large gift box placeholder.

---

## Edge Cases

1. **Two givers race to flag intent simultaneously.** The second flagFlag overwrites the first (last-write-wins on the `UPDATE`). Both see "You've marked this as planned." The first giver's flag is silently overwritten — acceptable given this is a soft signal, not a hard lock.

2. **Giver flags intent, then the item gets purchased by someone else before they complete the purchase.** When they click "Buy on [Retailer]" (external) or "Add to cart" (catalog), the item will show as "Claimed" — catch this at the confirm step or the purchase POST.

3. **External item's `product_url` was removed from the retailer's site** (404 on the external page). The giver will land on a 404 on the retailer site. Gifvtme can't prevent this. The item detail page should note "Available on Jumia" (current status not verified). Post-launch, periodic scrape-checks could surface broken links.

4. **Catalog item with no variants showing the variant selector.** If `product.hasVariants = false`, the variant selector is not rendered and "Add to cart" is immediately active.

5. **Giver is the receiver** (they're viewing their own shared link). They can flag intent on their own item — which is nonsensical. Consider checking `auth.uid() === wishlist.user_id` and hiding the intent flag button for the owner.

6. **Price changed (flash sale) between page load and CTA click.** For external items: irrelevant (price is just displayed, not used in transaction). For catalog items: the cart will show the current Sanity price, not whatever was on the item card — flash sale pricing handled at cart/checkout level.

---

## Analytics / Events
- `item_detail.viewed` (origin: external | catalog, status: available | claimed)
- `item_detail.buy_cta_clicked` (origin: external)
- `item_detail.add_to_cart` (origin: catalog, has_variant: bool)
- `item_detail.intent_flagged`
- `item_detail.intent_cleared`
- `item_detail.intent_warning_seen` (another user's flag was shown)
- `item_detail.buy_anyway_clicked` (proceeded past intent warning)

---

## Testing Requirements

### Unit tests
- `buildCombinationKey`: consistent key generation for same attribute selections in different order.
- Intent flag expiry logic: 23h59m → show, 24h01m → don't show.

### Integration tests
- Flag intent: `wishlist_items.intent_flagged_by` and `intent_flagged_at` set correctly.
- Clear intent: fields set back to null.
- Flag intent on purchased item: returns 409.
- External item: affiliate_url is the href on the "Buy on" button.
- Catalog item: add to cart stores correct product ID and variant in cart state.

### Manual QA
- Click "Buy on Jumia" — verify the affiliate URL opens in a new tab and the confirm prompt appears.
- Flag intent — verify the amber chip shows to another user viewing the same item (open in two browsers).
- 24 hours after flagging (or mock the timestamp): verify the chip disappears.
- Select an invalid variant combination (e.g. "XL Red" where that variant doesn't exist) — verify it's disabled.

---

## Acceptance Criteria
- [ ] External items show an affiliate redirect CTA; catalog items show an "Add to cart" CTA.
- [ ] Claimed items show the claimed state with no purchase CTAs.
- [ ] Intent flagging sets the correct DB fields and shows the amber warning chip to other viewers.
- [ ] An intent flag older than 24 hours is not displayed.
- [ ] Only the user who set a flag can clear it.
- [ ] Catalog items with variants require a valid variant selection before the cart CTA is active.
- [ ] Unauthenticated givers are redirected to login before they can flag intent or purchase.

---

## Future Improvements
- Real-time intent flag updates (Supabase realtime — another giver flags while you're on the page).
- "Notify me when this is available again" for claimed items (for future re-gifting).
- Giver gifting notes ("From all of us at work" — attached to the purchase for the receiver to see).
