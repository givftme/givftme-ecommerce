# Feature: External Item Addition — URL Scraping & Manual Fallback

## Overview
Lets receivers add gifts from anywhere on the internet by pasting a URL. Gifvtme calls Microlink to extract product metadata (title, image, price) automatically. When scraping fails — due to bot-blocking, heavy JavaScript rendering, or unsupported sites — the UI switches to a manual entry form. Items created via this flow have `origin='external'` and get an affiliate-tracked redirect URL built at save time.

---

## Goals
- Reduce friction: paste a URL, preview the result, save in one click.
- Never block item creation — scraping failure always falls back to manual entry.
- Capture the affiliate URL at add-time so it's ready when a giver clicks "Buy."
- Track which domains fail scraping to inform Microlink/Oxylabs decisions post-launch.

---

## User Stories
- As a receiver, I paste a product URL and Gifvtme auto-fills the title, image, and price.
- As a receiver, I can edit any auto-filled field before saving.
- As a receiver, when scraping fails, I see a clear message and can enter details manually.
- As a receiver, I can upload my own product image if the scraped one is wrong.

---

## Functional Requirements
1. `/api/scrape` accepts a URL, calls Microlink, and returns parsed metadata.
2. The scrape result preview is fully editable before saving — auto-fill is a starting point, not locked data.
3. Scrape failures return a 422 with a `reason` field — the frontend switches to the manual tab automatically.
4. Manual entry requires at minimum a title. All other fields (image, price, URL) are optional.
5. Price from Microlink is parsed as a float. If the currency Microlink detects is not NGN, display the scraped value alongside a note: "Scraped price may be in a foreign currency — verify before saving."
6. Image handling: scraped images use the external URL directly (no proxying). Manual uploads go to Supabase Storage under `item-images/<userId>/<uuid>`.
7. Affiliate URL is built server-side at the time of item creation via `lib/affiliate/transform.ts`. The original `product_url` is also stored alongside `affiliate_url`.
8. Domain analytics: log every scrape attempt with domain and outcome to an analytics event.

---

## Non-Functional Requirements
- Scrape request must complete or timeout within 8 seconds — show a progress indicator and offer a "skip to manual" escape at 5 seconds.
- The Microlink API key must be set for production use — without it, rate limits will quickly cap scraping for real users.

---

## UI Requirements

### Add item dialog/sheet
Two tabs: **"From URL"** (default) and **"Add manually"**.

**"From URL" tab:**
1. URL input (full width) with "Fetch" button.
2. On fetch: button shows spinner, input disabled.
3. On success: preview card appears below with:
   - Image (thumbnail, 80×80, click to upload a replacement)
   - Title (editable text input)
   - Price (number input with ₦ prefix)
   - URL (shown read-only, with "Change URL" link to restart)
   - Notes (optional textarea)
4. On success: "Add to wishlist" CTA (filled button).
5. At 5 seconds: "Still loading… Skip to manual entry?" link appears.
6. On failure: auto-switches to "Add manually" tab with a dismissible banner: "We couldn't fetch that page automatically. Add the details below."

**"Add manually" tab:**
1. Title (text input, required).
2. Image (file upload button — shows thumbnail preview after selection).
3. Price (number input, optional, ₦ prefix).
4. Product URL (text input, optional — lets user paste the original URL for givers to reference even without scraping working).
5. Notes (textarea, optional, max 200 chars).
6. "Add to wishlist" CTA.

**On both tabs:**
- Pressing Enter in a text input should not submit the form (it's inside a dialog with multiple fields).
- "Cancel" link dismisses the dialog.

---

## Backend Logic

### `POST /api/scrape`
```typescript
// 1. Validate input
const { url } = scrapeRequestSchema.parse(body)

// 2. Call Microlink
const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}&meta=false&screenshot=false`, {
  headers: { 'x-api-key': process.env.MICROLINK_API_KEY }
})
const data = await response.json()

// 3. Check Microlink status
if (data.status !== 'success') {
  // Track: analytics.track('scrape.failed', { domain: new URL(url).hostname })
  return NextResponse.json({ error: 'Could not fetch this page', reason: data.message }, { status: 422 })
}

// 4. Parse result
const result = {
  title: data.data.title || data.data.description || '',
  image_url: data.data.image?.url || data.data.logo?.url || null,
  price: parsePrice(data.data.price), // { amount: number | null, currency: string | null }
  product_url: url,
}

// Track: analytics.track('scrape.succeeded', { domain: new URL(url).hostname })
return NextResponse.json({ product: result })
```

**`parsePrice` helper:**
```typescript
function parsePrice(priceData: any): { amount: number | null, currency: string | null } {
  if (!priceData) return { amount: null, currency: null }
  const raw = typeof priceData === 'string' ? priceData : priceData.amount
  // Strip non-numeric except decimal point
  const numeric = parseFloat(String(raw).replace(/[^0-9.]/g, ''))
  return {
    amount: isNaN(numeric) ? null : numeric,
    currency: priceData.currency || null,
  }
}
```

### Affiliate URL building (in `/api/wishlists/[id]/items` POST handler)
```typescript
import { buildAffiliateUrl } from '@/lib/affiliate/transform'

const affiliate_url = buildAffiliateUrl(product_url) // returns affiliate URL or original URL with UTM params
```

### Image upload (client → Supabase Storage)
```
1. Client-side: validate file type and size before upload.
2. Upload to Supabase Storage: bucket 'item-images', path '<userId>/<uuid>.<ext>'.
3. Get public URL.
4. Pass image_url = publicUrl to the create-item API call.
```

---

## Database Changes
No new tables. Uses `wishlist_items` and `master_items` as defined in migration 001/003.

Supabase Storage bucket required: `item-images` (public bucket — images are displayed in shared contexts).

---

## API Endpoints

### `POST /api/scrape`
**Auth:** required.
**Request body:** `{ url: string }`
**Success response (200):**
```typescript
{
  product: {
    title: string,
    image_url: string | null,
    price: { amount: number | null, currency: string | null },
    product_url: string,
  }
}
```
**Failure response (422):** `{ error: string, reason: string }`
**Auth failure (401):** `{ error: "Unauthorized" }`
**Validation failure (400):** `{ error: string }`

---

## Permissions and Authorization
- `/api/scrape` requires an authenticated session. Anonymous scraping is not permitted (prevents abuse).
- Item image uploads: authenticated users can write to `item-images/<their_uid>/*` only.

---

## Validation

```typescript
const scrapeRequestSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
})

const manualItemSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  image_url: z.string().url().optional().or(z.literal("")),
  price: z.number().positive("Price must be a positive number").optional(),
  product_url: z.string().url().optional().or(z.literal("")),
  notes: z.string().max(200).optional(),
})
```

---

## Error Handling

| Scenario | Response / user message |
|---|---|
| Invalid URL format | "Please enter a valid URL (e.g. https://jumia.com/...)" |
| Microlink fetch timeout | 422 with reason: "timeout" → frontend: "This page took too long to load. Add details manually." |
| Microlink blocked by site | 422 with reason: "blocked" → frontend auto-switches to manual |
| Microlink returns partial data (no price) | 200 with `price: { amount: null }` — price field is empty in the preview, user fills in manually |
| Image upload too large | "Image must be under 5MB" |
| Image upload wrong type | "Please upload a JPEG, PNG, or WebP image" |
| Save fails after scrape success | "Couldn't save this item. Your fetched data is still shown — please try again." |

---

## Loading and Empty States
- Scrape in progress: "Fetch" button shows spinner, input disabled, "Still loading…" appears at 5s.
- Image uploading: thumbnail shows upload progress overlay.
- No scraped image: placeholder gift icon in the preview card.

---

## Edge Cases

1. **URL returns a price in USD (e.g. Amazon.com).** Display the amount with a "⚠ Verify currency" warning next to the price field. Never silently label a foreign-currency price as Naira.

2. **Microlink returns HTML title instead of product title** (e.g. "Amazon.com: [Product Name]: Electronics"). The auto-filled title will be verbose/wrong. This is acceptable — the user can edit it. Consider stripping common prefixes like "Amazon.com:" from the title client-side.

3. **User pastes the same URL twice.** No duplicate prevention in the current schema — the same product can appear multiple times. This is intentional (different color/size variants at different URLs). Don't block duplicate URLs, but consider a soft warning: "This URL is already in your wishlist."

4. **Scraped image is an ad or logo** (Microlink sometimes picks the wrong image). The preview shows it — the user can click to replace it with a file upload or a different image URL.

5. **User uploads an image but save fails.** The uploaded image is now orphaned in Supabase Storage. For v1, this is an accepted minor storage leak — implement a cleanup job post-launch if it becomes material.

6. **Product URL is a redirect chain** (e.g. a short link like `amzn.to/xyz`). Microlink follows redirects, so the resolved URL is what gets stored. The `affiliate_url` is built from whatever URL Microlink resolves to.

7. **User adds an item with no price.** Fully valid. The item card shows no price. On the shared wishlist, the giver sees no price (or the price section is hidden). The price-visibility toggle on the wishlist (`prices_visible`) is moot if there's no price to show.

---

## Analytics / Events
- `scrape.attempted` (domain: string)
- `scrape.succeeded` (domain: string)
- `scrape.failed` (domain: string, reason: string)
- `scrape.manual_fallback_used` (reason: string)
- `item.image.uploaded` (source: 'upload')
- `item.image.skipped`

---

## Testing Requirements

### Unit tests
- `parsePrice`: handles string prices ("₦12,000"), numeric prices, null, undefined, foreign currencies.
- `buildAffiliateUrl` in `lib/affiliate/transform.ts`: correct URL transformations for each supported retailer and UTM fallback.
- Zod schemas: valid/invalid URL, manual item validation.

### Integration tests
- `/api/scrape` with a real Jumia URL in a test environment (or a mocked Microlink response): correct metadata extracted.
- `/api/scrape` with a URL Microlink can't parse: 422 returned with correct structure.
- Item save with `origin='external'`: `affiliate_url` stored correctly.

### Manual QA
- Paste a Jumia product URL — verify title, image, price auto-fill, and the resulting `affiliate_url` has Jumia affiliate params.
- Paste an Amazon URL that is known to fail Microlink — verify the UI switches to manual and shows the correct banner.
- Add an item with no price — verify it saves and displays correctly (no price shown, no errors).
- Upload a custom image — verify it appears in Storage and the item card shows it.

---

## Acceptance Criteria
- [ ] A valid product URL from a major retailer (Jumia, Konga) auto-fills title, image, and price within 8 seconds.
- [ ] A scrape failure (any reason) activates the manual form with an explanatory message, never blocks item creation.
- [ ] The resulting `wishlist_items` row has a correctly built `affiliate_url`.
- [ ] A foreign-currency scraped price triggers a visible "verify currency" warning.
- [ ] Manual entry with only a title saves successfully.
- [ ] Image upload works and the image is displayed in the item card.

---

## Future Improvements
- Oxylabs as a Microlink fallback for high-value domains that block Microlink (Amazon, AliExpress).
- Automatic price change detection (re-scrape saved items weekly, notify receiver of drops).
- Browser extension: "Add to Gifvtme" while shopping on any site.
- Bulk import from Amazon wishlist URL.
