# Feature: Search

> **Status note (2026-08-06):** This feature was already mostly shipped (built during the `13-GIFT-MUSEUM-CATALOG.md` gap-closing pass) before this spec was audited against it directly. A follow-up gap-closing pass fixed 4 real issues: a missing mobile search entry point, an empty-query redirect that skipped the "enter at least 2 characters" prompt, analytics conflating too-short queries with genuine zero-result searches, and missing relevance ranking in `PRODUCT_SEARCH_QUERY`. See `context/ROADMAP.md`'s "Done" section for the full list of what changed and what was deliberately left as shipped (character-stripping set, no breadcrumb).

## Overview
Product search across the Gifvtme catalog using Sanity's GROQ `match` operator. A search input in the navbar routes to a `/search?q=` results page. The search GROQ query already exists in `lib/sanity/queries.ts` (`PRODUCT_SEARCH_QUERY`) but has no wired-up page or API route yet. This feature closes that gap.

---

## Goals
- Let shoppers find specific products quickly by name or description.
- Handle empty results, short queries, and special characters gracefully.
- Deliver results fast — Sanity GROQ search is near-instant for typical catalog sizes.

---

## User Stories
- As a shopper, I type in the navbar search box and am taken to a results page.
- As a shopper, I see relevant products matching my query with their current pricing.
- As a shopper, if nothing matches, I see a helpful empty state with browsing suggestions.
- As a shopper, I can add a search result directly to my cart or wishlist.

---

## Functional Requirements
1. Navbar has a search input — submitting (Enter or search button click) navigates to `/search?q=[query]`.
2. `/search` is a server-rendered page that fetches results from Sanity using `PRODUCT_SEARCH_QUERY`.
3. Results show as a product grid (same `ProductGrid` component used in collections).
4. Results include flash sale pricing if active at render time.
5. Minimum query length: 2 characters. Below 2: show "Enter at least 2 characters" prompt, no Sanity query fired.
6. Debounce: not needed on the dedicated search page (search fires on navigation, not on keystroke). If a live-search dropdown is added (future), debounce at 300ms.
7. Search query is sanitized before passing to GROQ — strip characters that could break GROQ string matching: `"`, `*`, `~`.
8. Result count shown: "X results for '[query]'"

---

## Non-Functional Requirements
- Search page uses `revalidate = 30` — short cache since catalog changes should be discoverable quickly.
- The search input in the navbar must be accessible (label, keyboard submit, correct `role`).

---

## UI Requirements

### Navbar search input
- Desktop: text input (always visible), placeholder "Search gifts…", search icon button on right.
- Mobile: search icon in the top bar — tapping opens a full-screen search overlay with a focused input.
- Submitting with a non-empty query (≥2 chars) navigates to `/search?q=[query]`.
- Pressing Escape closes the mobile search overlay.

### `/search?q=[query]` — Results page

**Header:**
- "X results for '[query]'" (or "Showing all results" if query is blank/short)
- Breadcrumb: "Shop → Search results"

**Product grid:**
- 2-col mobile, 3–4 col desktop
- Same `ProductGrid` component, same `ProductCard` with flash sale support
- "Add to wishlist" heart on each card

**Empty state:**
```
No results for '[query]'

Try:
· Checking your spelling
· Using fewer or different keywords
· Browsing the Gift Museum →
```

**Short query state** (< 2 chars):
"Enter at least 2 characters to search."

---

## Backend Logic

### GROQ query (in `lib/sanity/queries.ts`)
```groq
// PRODUCT_SEARCH_QUERY
*[_type == "product"
  && !(_id in path("drafts.**"))
  && [title, pt::text(description), string(tags)] match $query
] | score(
  boost(title match $query, 3),
  description match $query
) {
  _id, title, slug, basePrice, salePrice, saleStartTime, saleEndTime,
  "primaryImage": images[0],
  hasVariants,
  "minPrice": select(
    hasVariants => min(variants[available == true].price),
    basePrice
  )
} [0..23]
```

### Query sanitization
```typescript
// lib/sanity/search.ts
export function sanitizeSearchQuery(raw: string): string {
  return raw
    .trim()
    .replace(/["*~]/g, '') // remove GROQ special chars
    .slice(0, 100)          // max 100 chars
}
```

### Search page (server component)
```typescript
// app/search/page.tsx
export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const raw = searchParams.q || ''
  const query = sanitizeSearchQuery(raw)
  
  if (query.length < 2) {
    return <SearchPage results={[]} query={raw} tooShort={true} />
  }
  
  const results = await sanity.fetch(PRODUCT_SEARCH_QUERY, { query: `${query}*` })
  // Appending * enables prefix matching (e.g. "head" matches "headphones")
  
  return <SearchPage results={results} query={raw} />
}
```

---

## Database Changes
None — search is entirely Sanity-based.

---

## API Endpoints
No dedicated API route. The search results page is a server component. If a client-side live-search dropdown is added later, create `GET /api/search?q=[query]` as a thin wrapper around the GROQ query.

---

## Permissions and Authorization
- Search: fully public — no auth required.

---

## Validation
- Query length < 2: show prompt, skip Sanity call.
- Sanitize before passing to GROQ.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Sanity fetch error | Error boundary: "Couldn't load search results. Please try again." |
| Query < 2 chars | Show "Enter at least 2 characters" — no error, no empty state |
| 0 results | Empty state with browsing suggestions |
| Special chars only (after sanitization, query is empty) | Treat as too-short query |

---

## Loading and Empty States

- **Page loading:** skeleton product grid (8 cards).
- **0 results:** empty state with suggestions and Gift Museum link.
- **Query too short:** simple prompt.

---

## Edge Cases

1. **Query is only special characters** (e.g. `***`). After sanitization, becomes empty string. Treated as too-short. Show "Enter at least 2 characters."

2. **Very long query** (user pastes a paragraph). Truncated to 100 chars by `sanitizeSearchQuery`. The truncated version is still passed to Sanity — it will match on words within the query.

3. **Search navigates to `/search?q=` with empty q param.** Treated as blank search. Show the prompt. Don't run a Sanity query for an empty string (Sanity's `match ""` could behave unexpectedly).

4. **Results include flash sale products.** These show with sale price and badge — same as in the collection grid. `getActivePrice` used for price display.

5. **Typing in the navbar and pressing Enter quickly.** The page navigation fires. On slow connections, the user might press Enter while the previous search page is still loading. Next.js handles this with its built-in navigation cancellation.

---

## Analytics / Events
- `search.performed` (query, result_count)
- `search.empty_result` (query)
- `search.product_clicked` (product_id, position_in_results, query)

---

## Testing Requirements

### Unit tests
- `sanitizeSearchQuery`: removes `"`, `*`, `~`; truncates at 100 chars; trims whitespace.

### Integration tests
- GROQ search query: returns relevant products for known product names.
- Search with a product title returns that product in results.
- Search with gibberish returns 0 results.

### Manual QA
- Type a product name in the navbar search, press Enter — verify results page loads with matching products.
- Type 1 character — verify the "at least 2 characters" prompt.
- Type a query that matches nothing — verify the empty state with suggestions.
- Type `"drop*"` — verify special characters are stripped and the search still works.

---

## Acceptance Criteria
- [ ] Navbar search navigates to `/search?q=[query]` on submit.
- [ ] Results page fetches and displays Sanity products matching the query.
- [ ] Queries under 2 characters show a prompt and do not hit Sanity.
- [ ] Special characters in the query are sanitized before the GROQ call.
- [ ] 0-result searches show the empty state with Gift Museum CTA.
- [ ] Flash sale pricing appears correctly on search result cards.

---

## Future Improvements
- Live-search dropdown (results appear as you type, debounced).
- Search filters (occasion, price range, in-stock only).
- Search analytics to inform catalog curation (what people search for that has no results).
- Typo tolerance / fuzzy matching (Sanity's GROQ supports basic prefix matching but not fuzzy).
- Algolia or Typesense integration if catalog grows beyond ~1,000 products and GROQ performance degrades.
