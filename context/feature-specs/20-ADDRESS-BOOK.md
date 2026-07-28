# Feature: Address Book

## Overview
Saved shipping addresses for authenticated users. Exposed at `/account/addresses` for standalone management and integrated directly into the checkout flow as a pre-fill selector. A new `addresses` table that does not yet exist in any migration. The default address pre-fills checkout automatically. Shares the Nigerian states constant with the checkout form.

---

## Goals
- Eliminate re-typing shipping details on every order.
- Let users manage multiple delivery locations (home, office, a family member's address).
- Integrate cleanly with checkout so the default address requires zero additional steps.

---

## User Stories
- As a buyer, I can save a new shipping address from my account page or during checkout.
- As a buyer, I can mark one address as my default — it pre-fills checkout automatically.
- As a buyer, I can edit or delete any saved address.
- As a buyer with saved addresses, at checkout I see a dropdown to pick which address to ship to.

---

## Functional Requirements
1. `addresses` table: `id`, `user_id`, `label`, `full_name`, `phone`, `address_line_1`, `address_line_2`, `city`, `state`, `is_default`, `created_at`.
2. Partial unique index enforces one default per user at the DB level.
3. Saving a new address with `is_default=true` automatically unsets the previous default.
4. At checkout: if user has ≥1 saved address, show an address selector above the shipping form. Selecting a saved address pre-fills the form fields (still editable). "Enter a new address" option below the selector clears the form.
5. "Save this address for next time" checkbox at checkout — checked by default if user has no saved addresses, unchecked by default if they already have some.
6. No cap on number of addresses per user in v1.
7. Delete a default address: no new default is auto-selected — user has no default until they explicitly set one.

---

## Non-Functional Requirements
- `NIGERIAN_STATES` array exported from `lib/constants.ts` — used by both this feature and the checkout form.
- Address operations complete within 1 second.

---

## UI Requirements

### `/account/addresses`

**Header:** "Saved addresses" + "Add address" CTA (filled, `sm` size).

**Address card grid** (1 col mobile, 2 col desktop):
Each card:
- Label badge (if set — "Home", "Work")
- Full name + phone
- Address (line 1 + optional line 2, city, state)
- "Default" badge (brand-light bg, brand text) — only on the default card
- Three-dot overflow menu:
  - "Edit"
  - "Set as default" (only shown if not already default)
  - "Delete" (shows confirmation dialog)

**Add / Edit address sheet (mobile) / dialog (desktop):**
Fields:
- Label (optional, text input, placeholder "e.g. Home, Work, Mum's house")
- Full name (required)
- Phone number (required)
- Address line 1 (required)
- Address line 2 (optional)
- City (required)
- State (required, select from `NIGERIAN_STATES`)
- "Set as default" checkbox

CTA: "Save address" (filled). "Cancel" link.

**Delete confirmation dialog:**
"Are you sure you want to delete this address? This cannot be undone."
"Delete" (destructive variant) | "Cancel"

**Empty state:**
Gift box + map pin icon, "No saved addresses yet", "Add your first address" CTA.

### Checkout integration

**Address selector** (shown above the shipping form when user has ≥1 saved address):
shadcn `Select` component:
- Placeholder: "Choose a saved address"
- Options: each address formatted as "[Label or Full Name] — [Address Line 1], [City]"
- "Enter a new address ↓" as the last option (clears the form)

On select: pre-fills all form fields from the selected address (editable after pre-fill).

---

## Backend Logic

### Set as default
```typescript
async function setDefaultAddress(userId: string, addressId: string) {
  // Clear existing default first
  await supabase.from('addresses')
    .update({ is_default: false })
    .eq('user_id', userId)
    .eq('is_default', true)
  
  // Set new default
  await supabase.from('addresses')
    .update({ is_default: true })
    .eq('id', addressId)
    .eq('user_id', userId)
}
```

### Save address during checkout
```typescript
// Called in POST /api/checkout when save_address=true
async function saveAddressFromCheckout(userId: string, shipping: ShippingDetails) {
  const hasAddresses = await supabase
    .from('addresses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  
  const isFirst = (hasAddresses.count ?? 0) === 0
  
  await supabase.from('addresses').insert({
    user_id: userId,
    full_name: shipping.full_name,
    phone: shipping.phone,
    address_line_1: shipping.address_line_1,
    address_line_2: shipping.address_line_2,
    city: shipping.city,
    state: shipping.state,
    is_default: isFirst, // auto-default if it's the first address
  })
}
```

---

## Database Changes

```sql
-- Migration: add to migration_004 or new migration_005

CREATE TABLE addresses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label       TEXT,
  full_name   TEXT        NOT NULL,
  phone       TEXT        NOT NULL,
  address_line_1 TEXT     NOT NULL,
  address_line_2 TEXT,
  city        TEXT        NOT NULL,
  state       TEXT        NOT NULL,
  is_default  BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX addresses_user_id_idx ON addresses(user_id);

-- One default per user (partial unique index):
CREATE UNIQUE INDEX addresses_one_default_per_user
  ON addresses(user_id)
  WHERE is_default = true;

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own addresses"
  ON addresses
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

---

## API Endpoints

### `GET /api/account/addresses`
**Auth:** required.
**Response:** `{ addresses: Address[] }` — default first, then by `created_at DESC`.

### `POST /api/account/addresses`
**Auth:** required.
**Body:** `AddressPayload`
**Response:** `{ address: Address }`

### `PATCH /api/account/addresses/[id]`
**Auth:** required, owner.
**Body:** Partial `AddressPayload`
**Response:** `{ address: Address }`

### `PATCH /api/account/addresses/[id]/set-default`
**Auth:** required, owner.
**Body:** none.
**Response:** `{ updated: true }`

### `DELETE /api/account/addresses/[id]`
**Auth:** required, owner.
**Response:** `{ deleted: true }`

---

## Permissions and Authorization
- All routes: owner-only via RLS (`user_id = auth.uid()`).
- No cross-user address access under any circumstance.

---

## Validation

```typescript
// lib/constants.ts
export const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue',
  'Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu',
  'FCT (Abuja)','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina',
  'Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo',
  'Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara',
] as const

export type NigerianState = typeof NIGERIAN_STATES[number]

// lib/validation/address.ts
export const addressSchema = z.object({
  label:          z.string().max(50).optional(),
  full_name:      z.string().min(2).max(100),
  phone:          z.string().min(7).max(20),
  address_line_1: z.string().min(5).max(200),
  address_line_2: z.string().max(200).optional(),
  city:           z.string().min(2).max(100),
  state:          z.enum(NIGERIAN_STATES),
  is_default:     z.boolean().default(false),
})
```

---

## Error Handling

| Scenario | Message |
|---|---|
| Save fails | "Couldn't save this address. Please try again." |
| Delete fails | "Couldn't delete this address. Please try again." |
| Set-default partial failure | "Couldn't set as default. Please try again." — retry is safe |
| Address not found on PATCH/DELETE | 404 — "Address not found." |

---

## Loading and Empty States

- **Page loading:** 2 skeleton address cards.
- **Empty:** illustrated empty state, "No saved addresses yet", "Add address" CTA.
- **Save button:** spinner + disabled while in flight.

---

## Edge Cases

1. **User deletes their only default address.** No auto-selection — user has no default. Checkout address selector still works (shows all addresses, none pre-selected).

2. **`is_default=true` on insert when the partial unique index rejects it** (there's already a default). The insert will fail with a unique violation. To prevent this: always call the two-step "unset then set" logic rather than relying on `INSERT ... is_default=true` directly.

3. **User saves an address at checkout that's identical to an existing one.** No duplicate detection in v1 — two rows are created. Future: soft-deduplicate by comparing `address_line_1 + city + state`.

4. **Checkout `save_address=true` but the save silently fails.** The order must still proceed — never block order creation because of an address save failure. Address save runs independently after the order is initiated (fire-and-forget with error logging).

5. **User with many addresses** (edge case, no cap). The checkout address selector shows all of them. Consider capping the displayed list at 5 and showing "Manage addresses →" if the user has more.

---

## Analytics / Events
- `address.added` (is_first: bool)
- `address.edited`
- `address.deleted`
- `address.set_default`
- `address.used_at_checkout`
- `address.saved_from_checkout`

---

## Testing Requirements

### Unit tests
- `addressSchema`: all required fields, invalid state enum, phone too short.
- `NIGERIAN_STATES`: 37 entries.

### Integration tests
- Add address → row in DB with correct data.
- Set-default: previous default row unset, new default set.
- `addresses_one_default_per_user` index: attempt direct INSERT of two defaults → second fails.
- RLS: user A cannot read/write user B's addresses.
- Delete default address → no error, `is_default` remains false for all remaining rows.

### Manual QA
- Add three addresses. Set the second as default. Verify first loses "Default" badge, second gains it.
- Go to checkout. Verify default address pre-fills the form.
- Select a different address from the checkout selector — verify form pre-fills with that address.
- Select "Enter a new address" — verify form clears.
- Delete the default address. Go to checkout — verify no address is pre-filled.

---

## Acceptance Criteria
- [ ] `addresses` table exists with RLS and the partial unique index.
- [ ] Add, edit, delete, and set-default all work correctly.
- [ ] Only one default address per user at any time.
- [ ] Checkout shows an address selector for users with ≥1 saved address.
- [ ] Selecting a saved address pre-fills the checkout form.
- [ ] "Save this address" at checkout creates an `addresses` row without blocking order creation on failure.

---

## Future Improvements
- Address autocomplete (Google Places or Remita address API for Nigeria).
- "Share address" link — generate a URL that pre-fills a form for someone else to confirm.
- International addresses (post-NG expansion).
- Address validation against NIPOST database.
