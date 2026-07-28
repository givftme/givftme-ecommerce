# Feature: Account Management

## Overview
The buyer-facing account area at `/account/*`. Covers three sections: profile (see `01-identity/02-PROFILE-MANAGEMENT.md` for profile details), saved shipping addresses, and order history. The `/account` home is a navigation hub. This spec covers the addresses and order history pages; profile is documented separately.

---

## Goals
- Let buyers manage saved shipping addresses to speed up future checkouts.
- Give buyers a single place to view all their order history.
- Provide a clean, navigable account hub.

---

## User Stories
- As a buyer, I can save multiple shipping addresses and set a default.
- As a buyer, I can select a saved address at checkout instead of re-typing it.
- As a buyer, I can edit or delete a saved address.
- As a buyer, I can view all my orders from a single orders list.
- As a buyer, I can navigate to any order's detail page.

---

## Functional Requirements
1. `/account` home: navigation card grid linking to Profile, Addresses, Orders.
2. `/account/addresses`: full CRUD on `addresses` table. Default address highlighted. Checkout reads from this table.
3. `/account/orders`: lists all orders — tabs: Active (confirmed/processing/shipped), Completed (delivered), Cancelled. Reuses `OrderCard` component from `08-fulfillment/01-ORDER-TRACKING.md`.
4. `/account/orders/[id]`: full order detail — reuses the 4-step tracker + timeline from the order tracking feature.
5. Setting a new default address: unsets the previous default in the same transaction (enforced by the partial unique index on `addresses`).
6. The address CRUD flow must be accessible from both `/account/addresses` and inline during `/checkout` ("Add new address" within the checkout form).

---

## Non-Functional Requirements
- The account section is only accessible to authenticated users — middleware enforces this.
- Address form uses the same Nigerian states list as the checkout form — share this as a constant.

---

## UI Requirements

### `/account` — Account home

Grid of 3 nav cards (icon + label + arrow):
- 👤 **Profile** — "Name, photo, thank-you message"
- 📍 **Addresses** — "Saved delivery addresses"
- 📦 **Orders** — "Your order history"

User's name and avatar at the top of the page.

Mobile: stacked full-width cards. Desktop: 3-column card grid.

### `/account/addresses` — Address book

**Header:** "Saved addresses" + "Add address" CTA (filled, small).

**Address cards:**
Each card displays:
- Label (optional — "Home", "Work", etc.) or falls back to the name on the address
- Full name, phone
- Full address (line 1 + 2, city, state)
- "Default" badge (brand, if `is_default=true`)
- Three-dot menu: "Edit", "Set as default" (hidden if already default), "Delete"

**Empty state:** "No saved addresses. Add one to speed up your next checkout."

**Add/Edit address form** (bottom sheet mobile, dialog desktop):
- Label (optional, text input, placeholder: "Home, Work, etc.")
- Full name (required)
- Phone (required)
- Address line 1 (required)
- Address line 2 (optional)
- City (required)
- State (required, select from Nigerian states list)
- "Set as default" checkbox
- "Save" CTA

**Delete confirmation dialog:**
- "Delete this address?"
- "If this is your default address, you'll need to set a new one."
- "Delete" (destructive) + "Cancel"

### `/account/orders` — Orders list

Already fully specified in `08-FULFILLMENT/01-ORDER-TRACKING.md`. This page is the same as the order list in that feature — reuse the component.

### `/account/orders/[id]` — Order detail

Already fully specified in `08-FULFILLMENT/01-ORDER-TRACKING.md`. Reuse the full order detail component.

---

## Backend Logic

### Set default address (transaction)
```typescript
// POST /api/account/addresses (with is_default: true) or PATCH for existing
async function setDefaultAddress(userId: string, addressId: string) {
  // The partial unique index on addresses(user_id) WHERE is_default=true
  // means we can't just INSERT/UPDATE with is_default=true — we need to first
  // clear the current default, then set the new one.
  
  await supabase.from('addresses')
    .update({ is_default: false })
    .eq('user_id', userId)
    .eq('is_default', true)
  
  await supabase.from('addresses')
    .update({ is_default: true })
    .eq('id', addressId)
    .eq('user_id', userId)
}
```

Note: this is two separate operations, not a transaction (Supabase client doesn't expose transactions directly). The risk of a partial update (first succeeds, second fails) is low and acceptable in v1 — worst case, the user has no default address set until they try again.

### Pre-fill checkout from default address
In the checkout page server component:
```typescript
const defaultAddress = await supabase
  .from('addresses')
  .select('*')
  .eq('user_id', userId)
  .eq('is_default', true)
  .single()
// Pass to the checkout form as initial values
```

---

## Database Changes

**`addresses` table** (new — add to migration 004 or a new migration 005):
```sql
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label TEXT,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX addresses_user_id_idx ON addresses(user_id);
-- Enforce one default per user at the DB level:
CREATE UNIQUE INDEX addresses_one_default_per_user ON addresses(user_id) WHERE is_default = true;
```

Enable RLS:
```sql
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own addresses" ON addresses
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

---

## API Endpoints

### `GET /api/account/addresses`
**Auth:** required.
**Response:** `{ addresses: Address[] }` (sorted: default first, then by created_at desc).

### `POST /api/account/addresses`
**Auth:** required.
**Body:** `AddressPayload` (see validation below).
**Response:** `{ address: Address }`.

### `PATCH /api/account/addresses/[id]`
**Auth:** required (owner).
**Body:** partial `AddressPayload`.
**Response:** `{ address: Address }`.

### `DELETE /api/account/addresses/[id]`
**Auth:** required (owner).
**Response:** `{ deleted: true }`.

### `PATCH /api/account/addresses/[id]/set-default`
**Auth:** required (owner).
**Body:** none.
**Response:** `{ updated: true }`.

---

## Permissions and Authorization
- All address operations: owner-only via RLS (`user_id = auth.uid()`).
- No public access to any address data.

---

## Validation

```typescript
const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT (Abuja)', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina',
  'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo',
  'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
] as const

const addressSchema = z.object({
  label: z.string().max(50).optional(),
  full_name: z.string().min(2).max(100),
  phone: z.string().min(7).max(20),
  address_line_1: z.string().min(5).max(200),
  address_line_2: z.string().max(200).optional(),
  city: z.string().min(2).max(100),
  state: z.enum(NIGERIAN_STATES),
  is_default: z.boolean().default(false),
})
```

Export `NIGERIAN_STATES` from `lib/constants.ts` so it's shared between the address form and the checkout form.

---

## Error Handling

| Scenario | User-facing message |
|---|---|
| Add address fails | "Couldn't save this address. Please try again." |
| Delete address fails | "Couldn't delete this address. Please try again." |
| Set default fails (partial) | "Couldn't set this as your default address. Please try again." |
| Delete the only default address | Allow deletion — no address will be default until user sets one. At checkout, show all addresses without a pre-selected default. |

---

## Loading and Empty States

- **Addresses page loading:** 2–3 skeleton address cards.
- **Empty addresses:** "No saved addresses" with "Add address" CTA.
- **Add/Edit form submitting:** Save button shows spinner + disabled.

---

## Edge Cases

1. **User deletes their default address.** No default is set. The checkout form shows the address selector with no pre-selected value — user must select or enter an address. No error, just no pre-fill.

2. **User tries to save a 7th address** (no limit defined). In v1, allow unlimited addresses — no cap. If hoarding becomes an issue, a soft cap of 10 can be added later.

3. **User saves an address at checkout ("Save this address" checked) but address save fails.** The order creation should NOT be blocked by an address save failure. Save the address in a separate call after the order is initiated — any failure there is a background concern, not a blocking one.

4. **Nigerian states list changes.** The current list of 36 states + FCT is stable and unlikely to change. Hardcoding as a constant is appropriate. If the list needs updating, it's in one `lib/constants.ts` location.

5. **Phone number format.** Nigerian mobile numbers are typically `+234 XXXX XXXXX` or `0XXXX XXXXX`. The validation allows any 7–20 character string — loose validation is intentional to avoid frustrating users with strict format requirements on an optional-prefix field.

---

## Analytics / Events
- `account.addresses.page_viewed`
- `account.address.added`
- `account.address.edited`
- `account.address.deleted`
- `account.address.set_default`
- `account.orders.page_viewed` (tab: active | completed | cancelled)

---

## Testing Requirements

### Unit tests
- `addressSchema` validation: all required fields, invalid state, phone too short.
- `NIGERIAN_STATES` constant: 37 entries (36 states + FCT).

### Integration tests
- Add address: `addresses` row created with correct data.
- Set default: previous default unset, new default set.
- Delete default address: no default remains, no error thrown.
- RLS: user A cannot access user B's addresses.

### Manual QA
- Add 3 addresses. Verify all appear on the page.
- Set the second address as default — verify the first loses its default badge.
- Go to checkout — verify the default address pre-fills the shipping form.
- Delete the default address — verify checkout shows the form without a pre-fill.
- Edit an address — verify changes persist on page reload.

---

## Acceptance Criteria
- [ ] `addresses` table exists with RLS enabled.
- [ ] Users can add, edit, delete, and set-default addresses.
- [ ] Only one default address per user is enforced by the DB partial unique index.
- [ ] The checkout form pre-fills with the user's default address.
- [ ] The `/account/orders` and `/account/orders/[id]` pages correctly display order history and detail (reusing components from the order tracking feature).

---

## Future Improvements
- Address auto-complete via Google Places API (or a Nigerian-specific geocoding service).
- International shipping address support (post-Nigeria expansion).
- Address validation against a postal service database.
