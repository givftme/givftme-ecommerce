# Feature: Gift Pooling

## Overview
Group gifting where multiple people contribute money towards a single wishlist item or a receiver's wishlist generally. Contributors pay immediately via Flutterwave when they join a pool — no pledge system. The pool stays open until the target amount is reached. If the pool closes without hitting the target (occasion passes, or receiver cashes out early), the receiver gets the cash equivalent of whatever was raised. Pools can be created by the receiver themselves or by a giver organising on the receiver's behalf.

This feature activates the `group_gift_pools` table and `gifting_type` field already reserved in the schema.

---

## Goals
- Let groups of people collectively fund a gift that no one person could or wants to buy alone.
- Support both item-specific pools (₦150,000 laptop) and general wishlist pools (cash gift).
- Always guarantee the receiver gets value — either the procured item or the cash raised.
- Keep the contributor experience as simple as a regular Flutterwave checkout.

---

## User Stories

**As a receiver:**
- I can create a gift pool tied to a specific wishlist item or my wishlist generally.
- I can set a target amount and an optional message to contributors.
- I can share the pool link with people I want to contribute.
- I can see who has contributed and how much has been raised in real time.
- I can cash out the pool at any time and receive whatever has been raised.
- I get notified when the pool hits its target.

**As a giver/organiser:**
- I can create a pool on behalf of a receiver (to surprise them) and invite others to contribute.
- I can contribute to a pool someone else created.
- I can see the pool progress before I contribute.
- I receive a receipt email after contributing.

**As a contributor:**
- I can contribute any amount at or above the minimum (₦1,500).
- I pay immediately via Flutterwave.
- I receive confirmation that my contribution was received.
- I get notified when the pool is fully funded or cashed out.

---

## Functional Requirements

### Pool types
1. **Item pool** — tied to a specific `wishlist_items` row. Target amount defaults to the item's price but is editable. When fully funded and procured, the `wishlist_items.status` is set to `purchased`.
2. **General pool** — tied to a wishlist but not a specific item. Target amount is set freely by the creator. Funds are always paid out as cash to the receiver.

### Pool creation
3. Either the receiver or a giver can create a pool. The `created_by` field records who created it. If a giver creates it, the receiver is identified by their `wishlist_id` (they must have a shared/public wishlist link for the giver to create on their behalf).
4. Pool creator sets: target amount, optional title (defaults to item name or receiver name + "gift fund"), optional message to contributors, minimum contribution (default ₦1,500, adjustable up to ₦5,000 by the creator).
5. Creating a pool generates a unique shareable link: `/pool/[token]`.

### Contributing
6. Any authenticated user can contribute to a pool. Authentication required — no anonymous contributions (for receipt delivery and contributor history).
7. Contributor selects an amount (at or above the minimum). No maximum per contributor except the remaining pool balance (can't overpay).
8. Payment via Flutterwave. Immediate charge — no pledge system.
9. On Flutterwave confirmation: a `pool_contributions` row is created, `group_gift_pools.amount_raised` is incremented.
10. If a contribution would push `amount_raised` above `target_amount`, the contribution is capped at the remaining balance. The contributor is shown the capped amount before paying.
11. Contributor receives a receipt email via Resend.

### Pool completion
12. When `amount_raised >= target_amount`: pool status → `fully_funded`. Receiver is notified. Pool is closed to new contributions.
13. For item pools when fully funded: the internal ops team is notified (via Retool) to procure the item. On procurement, `wishlist_items.status = 'purchased'` and `group_gift_pools.status = 'procured'`.
14. For general pools when fully funded: funds are paid out to the receiver. `group_gift_pools.status = 'paid_out'`.

### Cash out
15. The receiver (or pool creator if they are the receiver) can cash out at any time, regardless of whether the target has been reached.
16. On cash out: `group_gift_pools.status = 'paid_out'`, `cashed_out_at = NOW()`, `cashed_out_amount = amount_raised`.
17. All contributors are notified of the cash out with the total raised.
18. Cash payout is processed manually by the ops team via Retool in v1 (Flutterwave payouts/transfers API is a v2 automation). The ops team sees a "cash out requested" flag in Retool and processes the bank transfer manually.

### Pool status machine
```
open → fully_funded → procured (item pools only)
open → paid_out (general pools or receiver cashes out)
open → cancelled (creator cancels before any contributions — full refund)
fully_funded → paid_out (if receiver prefers cash even after full funding)
```

### Cancellation
19. A pool can only be cancelled if `amount_raised = 0` (no contributions yet). Once money is in the pool, it cannot be cancelled — only cashed out.
20. If cancelled with `amount_raised = 0`: status → `cancelled`.

---

## Non-Functional Requirements
- Pool progress (amount raised, contributor count) updates in near-real-time via Supabase Realtime subscription on the pool page.
- The pool shareable link must work without auth (read-only view). Contributing requires auth.
- Flutterwave webhook must verify signature before incrementing `amount_raised` — same pattern as checkout.
- A single contributor paying twice (double-tap, network retry) must be idempotent — deduplicated by `idempotency_key`.

---

## UI Requirements

### Pool creation flow

**Entry points:**
- From a wishlist item's three-dot menu: "Create gift pool" → pre-fills item name and price as target
- From the wishlist page header: "Create gift fund" → general pool for the whole wishlist
- From a shared wishlist (giver view): "Organise a group gift" button → giver-created pool

**Creation form (bottom sheet mobile / dialog desktop):**

**Step 1 — Pool details**
- Pool title (pre-filled from item name or "[Receiver]'s Gift Fund", editable)
- Target amount (₦, pre-filled from item price if item pool, editable)
- Minimum contribution (₦, default 1,500, editable 1,500–5,000)
- Message to contributors (optional textarea, max 300 chars, placeholder: "Help me get this special gift!")
- Pool type indicator (read-only): "For: [Item Name]" or "General gift fund for [Receiver Name]"

**Step 2 — Review & create**
- Summary card: title, target, minimum, message preview
- "Create pool" CTA (filled)
- On success: navigates to the pool page with the shareable link

### `/pool/[token]` — Pool page (public)

**Header:**
- Pool title (h1)
- "Organised by [Creator Name]" (or "by [Receiver Name]" if self-created)
- "For [Receiver Name]" (if giver-created)
- Optional message from creator (italic, muted)

**Progress section:**
- Large circular progress ring (GSAP animated on mount)
- "₦[amount_raised] raised of ₦[target_amount]" 
- Percentage: "[X]% funded"
- Contributor count: "[N] people have contributed"
- Progress bar (brand red fill, animates via GSAP)

**Contributor list (optional, privacy-aware):**
- Shows contributor avatars/initials + "₦[amount]" for each
- If pool creator set `contributors_visible=false`: shows only the count, not names/amounts

**CTA section:**
- "Contribute to this pool" (filled, full width) — opens contribution flow
- If `status=fully_funded`: "🎉 This pool is fully funded!" banner, no CTA
- If `status=paid_out` or `procured`: "This gift has been fulfilled." banner
- If `status=cancelled`: "This pool has been cancelled." banner

**Pool management section** (only visible to pool creator / receiver):
- "Share link" + copy button
- "Cash out" button (ghost, destructive) → confirmation dialog
- "Cancel pool" button (only shown if `amount_raised=0`)
- Progress to target summary

### Contribution flow

**Modal/sheet on `/pool/[token]`:**

**Step 1 — Amount selection**
- Quick-select chips: ₦2,000 / ₦5,000 / ₦10,000 / ₦20,000 / Custom
- Custom amount input (number, ₦ prefix)
- "Remaining to reach target: ₦[X]" helper text
- Minimum contribution reminder: "Minimum ₦[min_amount]"
- If selected amount > remaining: auto-cap shown — "You're contributing ₦[remaining] to complete this pool"
- "Proceed to payment" CTA

**Step 2 — Confirm**
- Summary: "Contributing ₦[amount] to [Pool Title]"
- "Pay with Flutterwave" CTA (filled)
- On click: calls `POST /api/pools/[id]/contribute`, gets Flutterwave URL, redirects

**Post-payment:**
- Return to `/pool/[token]?contributed=true`
- Shows a success banner: "Thank you! Your contribution of ₦[amount] has been received."
- Progress ring animates to new total (GSAP)

### Cash out confirmation dialog
- "Cash out this pool?"
- Current raised amount shown: "₦[amount_raised] will be paid to [Receiver Name]"
- If item pool and not fully funded: "This item won't be procured — the receiver will receive the cash raised instead."
- "All [N] contributors will be notified."
- "Confirm cash out" (destructive/filled) | "Cancel"

### Dashboard — Pool management

**Receiver view at `/dashboard/pools`:**
- Active pools list (open + fully_funded)
- Past pools list (paid_out + procured + cancelled)
- Each card: pool title, progress bar, amount raised, contributor count, status badge, "View pool" link

**Notification in dashboard when pool hits target:**
- Banner: "🎉 [Pool Title] is fully funded! [View pool →]"

---

## Backend Logic

### Create pool
```typescript
// POST /api/pools

// 1. Auth check
// 2. Validate body
// 3. If item pool: verify wishlist_item belongs to a wishlist owned by the receiver
//    (or the giver has access to the shared wishlist)
// 4. Generate share token
const token = crypto.randomUUID()

// 5. Insert pool
const pool = await supabase.from('group_gift_pools').insert({
  wishlist_item_id: body.wishlist_item_id || null, // null for general pool
  wishlist_id: body.wishlist_id,
  created_by: auth.uid(),
  receiver_id: body.receiver_id, // wishlist owner
  title: body.title,
  target_amount: body.target_amount,
  min_contribution: body.min_contribution || 1500,
  message: body.message,
  token: token,
  status: 'open',
  amount_raised: 0,
  contributors_visible: body.contributors_visible ?? true,
}).select().single()

// 6. If item pool: update wishlist_items.gifting_type = 'group'
if (body.wishlist_item_id) {
  await supabase.from('wishlist_items')
    .update({ gifting_type: 'group' })
    .eq('id', body.wishlist_item_id)
}

return 201 { pool, share_url: `${APP_URL}/pool/${token}` }
```

### Contribute to pool
```typescript
// POST /api/pools/[id]/contribute

// 1. Auth check
// 2. Fetch pool — verify status = 'open'
const pool = await supabase.from('group_gift_pools')
  .select('*').eq('id', id).single()

if (pool.status !== 'open') return 409 { error: 'This pool is no longer accepting contributions.' }

// 3. Cap amount at remaining balance
const remaining = pool.target_amount - pool.amount_raised
const amount = Math.min(body.amount, remaining)

if (amount < pool.min_contribution) return 400 { error: `Minimum contribution is ₦${pool.min_contribution}` }

// 4. Idempotency check
const existing = await supabase.from('pool_contributions')
  .select('id').eq('idempotency_key', body.idempotency_key).single()
if (existing.data) return 200 { contribution_id: existing.data.id } // idempotent

// 5. Create pending contribution row
const contribution = await supabase.from('pool_contributions').insert({
  pool_id: id,
  contributor_id: auth.uid(),
  amount: amount,
  status: 'pending_payment',
  idempotency_key: body.idempotency_key,
}).select().single()

// 6. Initiate Flutterwave payment
const flutterwaveResponse = await initFlutterwavePayment({
  tx_ref: contribution.id,
  amount: amount,
  currency: 'NGN',
  customer: { email: user.email, name: user.full_name },
  redirect_url: `${APP_URL}/pool/${pool.token}?contributed=true&contribution_id=${contribution.id}`,
})

return 200 { contribution_id: contribution.id, payment_url: flutterwaveResponse.data.link }
```

### Flutterwave webhook — pool contribution
```typescript
// In POST /api/flutterwave/webhook — add pool contribution handler alongside order handler

// Check if tx_ref matches a pool_contributions.id
const contribution = await supabase.from('pool_contributions')
  .select('*, group_gift_pools(*)').eq('id', body.data.tx_ref).single()

if (contribution.data && contribution.data.status === 'pending_payment') {
  if (body.data.status === 'successful') {
    // 1. Mark contribution as paid
    await supabase.from('pool_contributions').update({
      status: 'paid',
      flutterwave_transaction_id: body.data.id,
      paid_at: new Date(),
    }).eq('id', contribution.data.id)

    // 2. Increment pool amount_raised
    const newAmountRaised = contribution.data.group_gift_pools.amount_raised + contribution.data.amount
    const newStatus = newAmountRaised >= contribution.data.group_gift_pools.target_amount
      ? 'fully_funded' : 'open'

    await supabase.from('group_gift_pools').update({
      amount_raised: newAmountRaised,
      status: newStatus,
      fully_funded_at: newStatus === 'fully_funded' ? new Date() : null,
    }).eq('id', contribution.data.pool_id)

    // 3. Send contribution receipt email
    await sendContributionReceiptEmail(contribution.data, contribution.data.group_gift_pools)

    // 4. If newly fully funded: notify receiver
    if (newStatus === 'fully_funded') {
      await sendPoolFullyFundedEmail(contribution.data.group_gift_pools)
    }
  } else {
    await supabase.from('pool_contributions').update({ status: 'failed' }).eq('id', contribution.data.id)
  }
}
```

### Cash out
```typescript
// POST /api/pools/[id]/cash-out

// 1. Auth — must be receiver_id or created_by
// 2. Fetch pool — must be status 'open' or 'fully_funded'
// 3. Update pool
await supabase.from('group_gift_pools').update({
  status: 'paid_out',
  cashed_out_at: new Date(),
  cashed_out_amount: pool.amount_raised,
}).eq('id', id)

// 4. Notify all contributors
const contributors = await supabase.from('pool_contributions')
  .select('*, users(email, full_name)').eq('pool_id', id).eq('status', 'paid')

for (const c of contributors.data) {
  await sendPoolCashedOutEmail(c, pool)
}

// 5. Flag for ops team in a pool_payouts table (manual bank transfer in v1)
await supabase.from('pool_payouts').insert({
  pool_id: id,
  receiver_id: pool.receiver_id,
  amount: pool.amount_raised,
  status: 'pending_ops_action',
})

return 200 { cashed_out: true, amount: pool.amount_raised }
```

---

## Database Changes

### Update `group_gift_pools` (currently reserved, empty of real columns):
```sql
-- Drop the stub and recreate with full schema
ALTER TABLE group_gift_pools
  ADD COLUMN IF NOT EXISTS wishlist_id UUID REFERENCES wishlists(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS message TEXT CHECK (char_length(message) <= 300),
  ADD COLUMN IF NOT EXISTS target_amount NUMERIC NOT NULL CHECK (target_amount > 0),
  ADD COLUMN IF NOT EXISTS amount_raised NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_contribution NUMERIC NOT NULL DEFAULT 1500,
  ADD COLUMN IF NOT EXISTS token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','fully_funded','procured','paid_out','cancelled')),
  ADD COLUMN IF NOT EXISTS contributors_visible BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS fully_funded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cashed_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cashed_out_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS group_gift_pools_token_idx ON group_gift_pools(token);
CREATE INDEX IF NOT EXISTS group_gift_pools_receiver_idx ON group_gift_pools(receiver_id);
CREATE INDEX IF NOT EXISTS group_gift_pools_wishlist_item_idx ON group_gift_pools(wishlist_item_id);
```

### New `pool_contributions` table:
```sql
CREATE TABLE pool_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES group_gift_pools(id) ON DELETE RESTRICT,
  contributor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment','paid','failed')),
  flutterwave_transaction_id TEXT,
  idempotency_key TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX pool_contributions_pool_id_idx ON pool_contributions(pool_id);
CREATE INDEX pool_contributions_contributor_idx ON pool_contributions(contributor_id);
```

### New `pool_payouts` table (ops team payout tracking):
```sql
CREATE TABLE pool_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES group_gift_pools(id) ON DELETE RESTRICT,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_ops_action'
    CHECK (status IN ('pending_ops_action','processing','completed')),
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,
  processed_by TEXT, -- ops team member name
  processed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### RLS policies:
```sql
-- group_gift_pools
ALTER TABLE group_gift_pools ENABLE ROW LEVEL SECURITY;

-- Public read via token (for the pool page)
CREATE POLICY "Public can view pools by token"
  ON group_gift_pools FOR SELECT
  USING (true); -- token-gated at application level, not RLS

-- Only creator or receiver can update
CREATE POLICY "Creator or receiver can manage pool"
  ON group_gift_pools FOR UPDATE
  USING (created_by = auth.uid() OR receiver_id = auth.uid());

-- Any authenticated user can create
CREATE POLICY "Authenticated users can create pools"
  ON group_gift_pools FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- pool_contributions
ALTER TABLE pool_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contributors see own contributions"
  ON pool_contributions FOR SELECT
  USING (contributor_id = auth.uid());

CREATE POLICY "Pool owner sees all contributions"
  ON pool_contributions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM group_gift_pools
      WHERE id = pool_contributions.pool_id
      AND (receiver_id = auth.uid() OR created_by = auth.uid()))
  );

CREATE POLICY "Authenticated users can contribute"
  ON pool_contributions FOR INSERT
  WITH CHECK (contributor_id = auth.uid());
```

---

## API Endpoints

### `POST /api/pools`
Create a new pool.
**Auth:** required.
**Body:**
```typescript
{
  wishlist_id: string,
  wishlist_item_id?: string,   // omit for general pool
  receiver_id: string,
  title: string,
  target_amount: number,
  min_contribution?: number,   // default 1500
  message?: string,
  contributors_visible?: boolean,
}
```
**Response:** `{ pool: Pool, share_url: string }`

### `GET /api/pools/[token]`
Fetch pool data by token (public).
**Auth:** none.
**Response:** `{ pool: PoolWithContributors }`

### `POST /api/pools/[id]/contribute`
Initiate a contribution payment.
**Auth:** required.
**Headers:** `Idempotency-Key: <uuid>`
**Body:** `{ amount: number }`
**Response:** `{ contribution_id: string, payment_url: string }`

### `POST /api/pools/[id]/cash-out`
Cash out a pool.
**Auth:** required (must be receiver or creator).
**Body:** none.
**Response:** `{ cashed_out: true, amount: number }`

### `POST /api/pools/[id]/cancel`
Cancel a pool (only if amount_raised = 0).
**Auth:** required (must be creator).
**Response:** `{ cancelled: true }`

### `GET /api/dashboard/pools`
List pools for the current user (as receiver or creator).
**Auth:** required.
**Response:** `{ active: Pool[], past: Pool[] }`

---

## Permissions and Authorization

| Action | Who |
|---|---|
| Create pool | Any authenticated user |
| View pool page | Anyone (token-gated at app level) |
| Contribute | Any authenticated user |
| Cash out | Receiver (`receiver_id`) or pool creator |
| Cancel | Pool creator only (and only if no contributions) |
| See contributor names/amounts | Pool creator + receiver always; others only if `contributors_visible=true` |
| Process payout | Ops team via Retool (service role) |

---

## Validation

```typescript
const createPoolSchema = z.object({
  wishlist_id: z.string().uuid(),
  wishlist_item_id: z.string().uuid().optional(),
  receiver_id: z.string().uuid(),
  title: z.string().min(3).max(100),
  target_amount: z.number().min(1500, "Target must be at least ₦1,500"),
  min_contribution: z.number().min(1500).max(5000).default(1500),
  message: z.string().max(300).optional(),
  contributors_visible: z.boolean().default(true),
})

const contributeSchema = z.object({
  amount: z.number().positive(),
  // min_contribution checked server-side against the pool's own setting
})
```

---

## Error Handling

| Scenario | Response |
|---|---|
| Contribute to a fully_funded / paid_out pool | 409: "This pool is no longer accepting contributions." |
| Amount below minimum | 400: "Minimum contribution is ₦[min_amount]." |
| Amount exceeds remaining balance | Auto-cap shown before payment — not an error |
| Flutterwave payment fails | `pool_contributions.status = 'failed'`; contributor sees payment failed screen |
| Duplicate contribution (idempotency) | 200 with existing contribution_id |
| Cancel pool with existing contributions | 400: "This pool has received contributions and cannot be cancelled. You can cash out instead." |
| Cash out a cancelled pool | 409: "This pool has already been cancelled." |
| Receiver has no bank account on file for payout | Pool is cashed out, `pool_payouts` row created — ops team contacts receiver for bank details manually in v1 |

---

## Loading and Empty States

- **Pool page loading:** skeleton progress ring + skeleton contributor list.
- **No contributions yet:** "Be the first to contribute!" below the progress bar.
- **Pool fully funded:** celebratory banner, progress ring at 100% (GSAP animate to full).
- **Dashboard pools — empty:** "No active gift pools. Create one for an upcoming occasion."

---

## Edge Cases

1. **Two contributors submit simultaneously and both would exceed the target.** The webhook handler increments `amount_raised` non-atomically — could result in `amount_raised > target_amount`. Fix: use a Postgres function with `SELECT ... FOR UPDATE` to atomically check and increment:
```sql
CREATE OR REPLACE FUNCTION increment_pool_amount(pool_id UUID, increment NUMERIC)
RETURNS NUMERIC AS $$
DECLARE new_amount NUMERIC;
BEGIN
  UPDATE group_gift_pools
  SET amount_raised = LEAST(amount_raised + increment, target_amount),
      status = CASE WHEN amount_raised + increment >= target_amount THEN 'fully_funded' ELSE status END
  WHERE id = pool_id AND status = 'open'
  RETURNING amount_raised INTO new_amount;
  RETURN new_amount;
END;
$$ LANGUAGE plpgsql;
```

2. **Receiver cashes out while a Flutterwave payment is in flight.** The payment completes, webhook fires, tries to increment a `paid_out` pool. The webhook handler checks `status = 'open'` before incrementing — if pool is already `paid_out`, the contribution amount is refunded manually. Flag in `pool_contributions.notes`: "Pool closed during payment — refund required." Ops team handles manually via Retool in v1.

3. **Giver creates a pool on behalf of a receiver, but the receiver's wishlist is private.** The giver would need the wishlist link to know the `wishlist_id` and `receiver_id`. If the wishlist is `private`, the giver shouldn't have this information. Validate on pool creation: the wishlist must be `friends_family` or `public` for a giver-created pool. Receivers can always create pools for their own private wishlists.

4. **Pool item price changes in Sanity after the pool is created.** The pool has its own `target_amount` which is set at creation and never auto-updates. The receiver can edit the pool title but not the target amount once contributions exist (to protect contributor trust — they paid towards a stated target).

5. **Receiver has no bank account registered when they cash out.** The `pool_payouts` row is created with `status='pending_ops_action'`. The ops team sees this in Retool and contacts the receiver for their bank details. Not a blocking error — the cash out is recorded, the ops team follows up. In v2, add a bank account field to the user profile or addresses table.

6. **Multiple pools open for the same wishlist item simultaneously.** Not blocked by the schema (removed the old unique constraint on `wishlist_item_id`). Multiple pools for the same item is confusing — recommend a soft validation warning: "There's already an open pool for this item. Are you sure you want to create another?" Not a hard block.

7. **Contributor wants a refund.** No automated refund system in v1. Contributor must contact support. Ops team can issue a refund via Flutterwave dashboard manually. Document this in the app's help/FAQ: "Contributions are non-refundable unless the pool is cancelled before any contributions are made."

---

## Email Templates

### Contribution receipt (to contributor)
```
Subject: Your contribution to "[Pool Title]" was received
Body: You contributed ₦[amount] to [Pool Title].
      Pool progress: ₦[amount_raised] of ₦[target_amount] ([X]% funded)
      [N] people have contributed so far.
      View pool: [link]
```

### Pool fully funded (to receiver)
```
Subject: 🎉 Your gift pool "[Pool Title]" is fully funded!
Body: Great news — [Pool Title] has reached its target of ₦[target_amount]!
      [N] people contributed to make this happen.
      [View your pool →]
      [If item pool]: We'll start procuring your gift shortly.
      [If general pool]: Your ₦[amount] will be transferred to you soon.
```

### Pool cashed out (to all contributors)
```
Subject: "[Pool Title]" has been fulfilled
Body: The gift pool you contributed to has been completed.
      ₦[cashed_out_amount] was raised in total across [N] contributors.
      Thank you for being part of this!
```

### Payout request (to ops team — internal Retool notification or email)
```
Subject: [ACTION REQUIRED] Pool payout — ₦[amount] to [Receiver Name]
Body: Pool: [title]
      Amount: ₦[amount]
      Receiver: [name, email]
      Pool ID: [id]
      View in Retool: [link]
```

---

## Analytics / Events
- `pool.created` (type: item | general, target_amount)
- `pool.viewed` (pool_id, viewer_type: creator | receiver | contributor | public)
- `pool.contribution.started` (pool_id, amount)
- `pool.contribution.completed` (pool_id, amount, pool_percentage_after)
- `pool.fully_funded` (pool_id, contributor_count, days_to_fund)
- `pool.cashed_out` (pool_id, amount_raised, target_amount, percentage_funded)
- `pool.cancelled`
- `pool.link.copied`

---

## Testing Requirements

### Unit tests
- `createPoolSchema` and `contributeSchema` validation.
- `increment_pool_amount` Postgres function: concurrent increments don't exceed target.
- Amount capping: contribution of ₦50k against ₦10k remaining caps at ₦10k.

### Integration tests
- Create pool → `group_gift_pools` row with correct token, status='open'.
- Contribute → Flutterwave initiated, `pool_contributions` row at `pending_payment`.
- Webhook success → `pool_contributions.status='paid'`, `amount_raised` incremented.
- Webhook pushes pool to target → `status='fully_funded'`, receiver notified.
- Cash out → `status='paid_out'`, `pool_payouts` row created, contributors notified.
- Cancel with contributions → rejected with correct error.
- Idempotency: same `idempotency_key` twice → same contribution_id, no duplicate payment.

### Manual QA
- Create an item pool from a wishlist item. Verify the pool page shows the correct title, target, and item reference.
- Contribute to the pool via Flutterwave sandbox. Verify `amount_raised` increments and receipt email is received.
- Contribute enough to fully fund the pool. Verify `status='fully_funded'`, receiver notification email.
- Cash out a partially funded pool. Verify `pool_payouts` row created, contributor emails sent, pool page shows fulfilled state.
- Attempt to contribute to a closed pool. Verify correct error message.
- Create a giver-initiated pool on a public wishlist. Verify it appears on the receiver's `/dashboard/pools`.

---

## Acceptance Criteria
- [ ] `group_gift_pools` table extended with full schema; `pool_contributions` and `pool_payouts` tables created.
- [ ] Receiver and giver can both create a pool (item or general).
- [ ] Pool shareable link works without auth; contributing requires auth.
- [ ] Contributions pay immediately via Flutterwave; webhook increments `amount_raised`.
- [ ] Concurrent contributions never push `amount_raised` above `target_amount` (atomic Postgres function).
- [ ] Pool status transitions correctly: open → fully_funded → procured/paid_out.
- [ ] Receiver can cash out at any time; contributors are notified; `pool_payouts` row created for ops.
- [ ] Receipt email sent to contributor on successful payment.
- [ ] Fully funded notification sent to receiver.
- [ ] Idempotency key prevents duplicate contributions on network retry.

---

## Future Improvements
- Automated bank payouts via Flutterwave Transfers API (eliminates manual ops step).
- Pledge-first mode: contributors reserve a slot, pay closer to the occasion date.
- Pool expiry date (auto-cash-out on occasion date if not fully funded).
- Anonymous contributions (no Gifvtme account required — just pay and enter a name).
- Co-organiser role (giver-created pool, receiver added as co-admin without spoiling the surprise).
- Contribution tiers ("Buy them dinner" ₦5k / "Help with the laptop" ₦20k / "Go all out" ₦50k).
- Social sharing of pool milestone (e.g. "50% funded — help us get there!").
