# Feature: Reviews

## Overview
Verified-purchase product reviews. Only customers who have completed a delivered order containing a specific product can review it. One review per product per user. Displayed on the product detail page with a rating breakdown chart. Editable and deletable by the author. GSAP-animated rating selector and bar chart on submission.

---

## Goals
- Build buyer trust through authentic, verified reviews.
- Prevent spam and fake reviews via the verified-purchase gate.
- Surface useful review data (average rating, breakdown) alongside each product.
- Keep the submission UX delightful without being heavy.

---

## User Stories
- As a verified purchaser, I can leave a star rating and optional written review for a product I bought.
- As a shopper, I can see the average rating and rating breakdown for any product.
- As a shopper, I can read individual reviews on a product detail page.
- As a reviewer, I can edit or delete my own review.
- As a shopper, I can see when a review was written and by whom.

---

## Functional Requirements
1. Review eligibility: user must have at least one `order_items` row for the product with a parent `orders.status = 'delivered'`. Checked server-side before allowing submission.
2. One review per user per product — enforced by a UNIQUE constraint on `(user_id, catalog_product_id)`.
3. Required: star rating (1–5). Optional: written body (up to 1000 characters).
4. Submission route: `/reviews/new?product_id=[sanityId]` — a dedicated page, not a modal, to allow focused composition.
5. Edit: a reviewer can return to the same route and update their rating or body. The route detects an existing review and pre-fills the form.
6. Delete: soft-delete (set `deleted_at`) rather than hard-delete, so aggregate counts remain accurate with a note. Actually, for simplicity in v1, **hard-delete** is fine — decrement the aggregate on delete.
7. Reviews are displayed on the product detail page under a "Reviews" tab.
8. Rating aggregates (average, count per star level) are computed by query, not a stored column, so they're always current.
9. Reviews are paginated: 10 per page, sorted newest first by default.

---

## Non-Functional Requirements
- The verified-purchase check is a server-side gate — never a client-side check only.
- Review submission must complete within 3 seconds.

---

## UI Requirements

### Product detail page — Reviews tab

**Rating summary section:**
- Average rating (large number, e.g. "4.2") + star display
- Total review count ("based on 47 reviews")
- Rating breakdown bar chart (5 rows — 5★ through 1★):
  - Each row: star label, GSAP-animated progress bar (brand color, animates to width on tab view), count label
- "Write a review" CTA — only shown if user is authenticated AND has a delivered order for this product; otherwise hidden.

**Review cards:**
Each card:
- Reviewer avatar (initials fallback) + name
- Star rating (filled stars)
- Date ("3 months ago" — relative time)
- Review body (if present, max 3 lines with "Read more" expand)
- "Edit" / "Delete" links (only visible to the review author)

**Pagination:** "Load more reviews" button or numbered pagination below the cards.

**No reviews state:** "No reviews yet. Be the first to share your experience."

### `/reviews/new?product_id=[id]` — Submission page

**Header:**
- Product thumbnail + title (fetched from Sanity by `product_id`)
- "Your review for [Product Name]"

**Rating selector:**
- 5 large star icons (lucide `Star`, 40px each)
- Click a star → fills that star and all below it
- GSAP: on click, small scale-up animation on the clicked star
- Selected rating shown as "X out of 5"
- "Please select a rating" error if submitted without selection

**Review body:**
- Textarea, optional, max 1000 chars, character counter
- Placeholder: "Share your experience with this product…"

**Actions:**
- "Submit review" (filled, full width)
- "Cancel" → back to product page

**Edit mode** (pre-filled):
- Same form, pre-filled with existing rating and body
- CTA: "Update review"
- "Delete review" (destructive text button, below separator) → confirmation dialog

---

## Backend Logic

### Verified purchase gate (server-side, in `/reviews/new` page and in `POST /api/reviews`)
```typescript
async function isVerifiedPurchaser(userId: string, catalogProductId: string): Promise<boolean> {
  const { data } = await supabase
    .from('order_items')
    .select('id, orders!inner(status, user_id)')
    .eq('catalog_product_id', catalogProductId)
    .eq('orders.user_id', userId)
    .eq('orders.status', 'delivered')
    .limit(1)
  
  return (data?.length ?? 0) > 0
}
```

### `POST /api/reviews`
```typescript
// 1. Auth check
// 2. Verify purchaser
const eligible = await isVerifiedPurchaser(userId, catalog_product_id)
if (!eligible) return 403 { error: 'You must have purchased and received this product to leave a review.' }

// 3. Check for existing review (for edit path)
const existing = await supabase.from('reviews').select('id').eq('user_id', userId).eq('catalog_product_id', catalog_product_id).single()
if (existing.data) {
  // Update existing
  return await supabase.from('reviews').update({ rating, body }).eq('id', existing.data.id).select().single()
}

// 4. Insert new review (upsert handles the race condition)
const { data, error } = await supabase.from('reviews')
  .insert({ user_id: userId, catalog_product_id, rating, body })
  .select().single()

if (error?.code === '23505') return 409 { error: 'You have already reviewed this product.' }
return 201 { review: data }
```

### `DELETE /api/reviews/[id]`
```typescript
// Auth check: reviewer must be the author
const review = await supabase.from('reviews').select('user_id').eq('id', id).single()
if (review.data.user_id !== userId) return 403
await supabase.from('reviews').delete().eq('id', id)
return { deleted: true }
```

### Rating aggregates query (used on product detail page)
```typescript
const { data } = await supabase
  .from('reviews')
  .select('rating')
  .eq('catalog_product_id', catalogProductId)

const total = data.length
const average = total > 0 ? data.reduce((sum, r) => sum + r.rating, 0) / total : 0
const breakdown = [5, 4, 3, 2, 1].map(star => ({
  star,
  count: data.filter(r => r.rating === star).length,
  percentage: total > 0 ? (data.filter(r => r.rating === star).length / total) * 100 : 0,
}))
```

---

## Database Changes

**New `reviews` table (migration 004 — not yet in any migration):**
```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  catalog_product_id TEXT NOT NULL, -- Sanity document _id
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body TEXT CHECK (char_length(body) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT one_review_per_user_per_product UNIQUE (user_id, catalog_product_id)
);

CREATE INDEX reviews_product_idx ON reviews(catalog_product_id);
CREATE INDEX reviews_user_idx ON reviews(user_id);
```

**Auto-update `updated_at`:**
```sql
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Assumes update_updated_at_column() function already exists from migrations 001/002
```

---

## API Endpoints

### `POST /api/reviews`
Create or update a review (upsert by auth user + product).
**Auth:** required.
**Body:**
```typescript
{
  catalog_product_id: string, // Sanity _id
  rating: number,             // 1–5
  body?: string,              // optional, max 1000 chars
}
```
**Success (201):** `{ review: Review }`
**Ineligible (403):** `{ error: string }`
**Duplicate (409):** `{ error: string }`

### `PATCH /api/reviews/[id]`
Update own review.
**Auth:** required (must be author).
**Body:** `{ rating?: number, body?: string }`
**Response:** `{ review: Review }`.

### `DELETE /api/reviews/[id]`
Delete own review.
**Auth:** required (must be author).
**Response:** `{ deleted: true }`.

### `GET /api/reviews?product_id=[id]&page=[n]`
Get paginated reviews for a product.
**Auth:** none (public).
**Response:** `{ reviews: ReviewWithUser[], total: number, average: number, breakdown: RatingBreakdown[] }`.

---

## Permissions and Authorization
- `reviews` RLS:
  - Anyone can SELECT (public reviews).
  - Authenticated users can INSERT their own (`user_id = auth.uid()`).
  - Authors can UPDATE/DELETE their own (`user_id = auth.uid()`).
- Server-side verified-purchase check is the primary gate for creating a review — RLS alone doesn't enforce this.

---

## Validation

```typescript
const reviewSchema = z.object({
  catalog_product_id: z.string().min(1),
  rating: z.number().int().min(1, "Please select a rating").max(5),
  body: z.string().max(1000, "Review must be under 1000 characters").optional(),
})
```

---

## Error Handling

| Scenario | User-facing message |
|---|---|
| Not a verified purchaser | "You need to have purchased and received this product to leave a review." |
| Already reviewed | "You've already reviewed this product. Edit your existing review instead." |
| Rating not selected | "Please select a star rating." |
| Submit fails (network) | "Couldn't submit your review. Please try again." |
| Delete fails | "Couldn't delete your review. Please try again." |

---

## Loading and Empty States

- **Reviews tab loading:** skeleton rating summary + 3 skeleton review cards.
- **No reviews:** "No reviews yet. Be the first to share your experience!" (only shows "Write a review" CTA to verified purchasers).
- **Review submission:** "Submit review" button shows spinner + disabled state.
- **Product not found on submission page:** redirect to `/shop` with toast: "Product not found."

---

## Edge Cases

1. **User bought the product, order is `delivered`, then the product is removed from Sanity.** The `reviews` table stores `catalog_product_id` as a TEXT (not a FK to Sanity — Sanity docs aren't in the DB). The review row persists. On the product detail page: this edge case is moot since the product page doesn't exist anymore. The review lives in the DB but is orphaned. Acceptable.

2. **User submits a review while another tab also submits** (network retry). The UNIQUE constraint and the upsert logic in `POST /api/reviews` mean the second attempt updates the existing row rather than creating a duplicate. No error surfaces.

3. **Order refunded after the user left a review.** The review is not automatically removed. Business decision: should refunded orders count as "verified purchases"? Recommendation: yes, since the customer still received and used the product before the refund.

4. **Review body is blank (rating-only review).** Valid — `body` is optional. The review card simply doesn't show a body section.

5. **Very long review body** (1000 chars). The review card shows max 3 lines and a "Read more" expand. No truncation in the DB or API — the length limit is enforced at validation.

6. **GSAP bar chart animation plays every time the Reviews tab is opened.** GSAP timeline should only play once per page visit, or only when the tab first becomes visible — use `useGSAP` with `deps: [isVisible]` where `isVisible` is tracked via `IntersectionObserver` or a tab-open state.

---

## Analytics / Events
- `review.submission_page.viewed` (product_id, is_eligible: bool)
- `review.submitted` (rating, has_body: bool)
- `review.edited`
- `review.deleted`
- `review.tab.viewed` (product_id, review_count)
- `review.read_more.clicked`

---

## Testing Requirements

### Unit tests
- `reviewSchema` validation: missing rating, body too long, rating out of range.
- `isVerifiedPurchaser`: returns true/false for various order status combinations.
- Rating aggregate calculation: correct average and breakdown from sample data.

### Integration tests
- Verified purchaser can submit a review: `reviews` row created.
- Non-purchaser blocked at API: 403 returned.
- Duplicate review: second POST updates the existing row (upsert), not a 409.
- `UNIQUE` constraint: two rows with same (user_id, catalog_product_id) → constraint violation.
- Delete: removes the row; subsequent GET no longer includes it.

### Manual QA
- Complete a full order to `delivered` status. Navigate to the product page. Verify "Write a review" CTA appears.
- Submit a review with only a star rating (no body) — verify it submits successfully.
- Submit a review with all fields — verify it appears on the product page.
- Edit the review — verify the updated rating and body show immediately.
- Delete the review — verify it's removed and the "Write a review" CTA reappears.
- Log in as a different user without a delivered order for the product — verify "Write a review" is NOT shown.

---

## Acceptance Criteria
- [ ] The `reviews` table and `one_review_per_user_per_product` UNIQUE constraint exist.
- [ ] Only users with a `delivered` order containing the product can access the review submission page and API.
- [ ] Submitting a review (first time) creates a `reviews` row; submitting again updates the existing one.
- [ ] One review per user per product is enforced at the DB constraint level.
- [ ] Reviews and rating breakdown display correctly on the product detail page.
- [ ] GSAP bar chart animates on first view of the Reviews tab.
- [ ] Authors can edit and delete their own reviews; others cannot.

---

## Future Improvements
- Photo reviews (attach images to a review).
- "Helpful" voting on reviews.
- Merchant responses to reviews (from the ops team).
- Review moderation queue (flag inappropriate reviews).
- Review incentives (small discount for leaving a verified review).
