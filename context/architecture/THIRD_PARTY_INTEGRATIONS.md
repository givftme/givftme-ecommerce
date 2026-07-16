# Gifvtme — Third-Party Integrations

## Microlink (URL scraping)

**Used for:** extracting product title, image, and price from external URLs pasted into the wishlist UI.
**Integration point:** `lib/scraper/microlink.ts`, called from `/api/scrape`.
**Auth:** `MICROLINK_API_KEY` env var, sent as `x-api-key` header. Works without a key at lower rate limits, but production should always have a key set.
**Known constraint:** Microlink can fail to scrape certain sites (heavy JS rendering, aggressive bot blocking — Amazon is a known difficult case). The scrape route returns a 422 in this case; the frontend must always offer a manual-entry fallback (title/image/price typed in directly) — never make scraping the only path to adding an external item.
**Price parsing:** Microlink returns price as `{ amount, currency }` — the integration code parses `amount` as a float and defaults currency to NGN if Microlink doesn't detect one, since the scraped currency field is unreliable for non-Nigerian sites and we don't support multi-currency anyway.

## Flutterwave (payments)

**Used for:** processing payment for catalog (Gifvtme checkout) purchases only — never for external/affiliate items.
**Integration points:** `/api/checkout` (initiate payment, to be built) and `/api/flutterwave/webhook` (receive confirmation, to be built) — see `API_ROUTES.md`.
**Auth:** Flutterwave secret key, env var (name TBD when implemented, likely `FLUTTERWAVE_SECRET_KEY`).
**Critical security note:** the webhook handler must verify Flutterwave's signature (typically a `verif-hash` header compared against a configured secret) before trusting any payload. Never update `orders.status` to `confirmed` based on an unverified webhook call, and never rely solely on the client-side redirect-back-from-payment as proof of payment — always confirm via the webhook or a server-side verification call to Flutterwave's API.
**Currency:** all charges in NGN — Flutterwave supports this natively for Nigerian merchants.

## Resend (email)

**Used for:** order status update emails, reminder emails (Flow 1 and Flow 2), thank-you message delivery if email-based.
**Integration point:** `lib/email/reminders.ts` currently handles reminder *scheduling* (creating rows in the `reminders` table) — the actual send-via-Resend call is not yet implemented in `/api/reminders` (flagged as a TODO there). Do not assume reminder emails are live; check `ROADMAP.md`.
**Auth:** `RESEND_API_KEY` env var, `RESEND_FROM_EMAIL` for the sender address.
**Order status emails:** intended to fire on every `order_status_history` insert (see `ERROR_HANDLING.md`) — not yet wired up as of this writing.

## Retool (internal operations)

**Used for:** order review and status updates, catalog/collection management support (though primary catalog editing happens in Sanity Studio, not Retool).
**Integration boundary:** Retool connects **directly to Supabase** using the service role key — it does not go through any Next.js API route. This is intentional; do not build a parallel Next.js admin API "just in case," since it duplicates Retool's job.
**Important:** because Retool uses the service role key, it bypasses all RLS policies. This is the one place in the system where that's expected and correct. Never expose the service role key to any customer-facing code path.

## Sanity (CMS)

**Used for:** all product catalog, collection, and occasion-museum content.
**Integration point:** `lib/sanity/client.ts` (the client, CDN-backed for performance via `useCdn: true`) and `lib/sanity/queries.ts` (every GROQ query, centralized — never write GROQ inline in a page).
**Auth:** `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET` env vars (public — Sanity's read API doesn't require a secret for public datasets). A separate write token would be needed if Next.js ever needs to write to Sanity programmatically (not currently the case — all catalog writes happen through Sanity Studio by the catalog team).
**Caching:** pages fetching Sanity data should set a `revalidate` value (see `app/page.tsx` for the pattern, `revalidate = 60`) rather than fetching fully dynamically on every request, since catalog content doesn't need to be real-time fresh.

## Dropshipping suppliers (Spocket / CJDropshipping)

**Used for:** sourcing the products listed in Gifvtme's catalog.
**Integration boundary:** **none, programmatically, in v1.** This is a manual process — the catalog team sources products through the supplier platforms directly and enters them into Sanity by hand, and the internal ops team manually forwards confirmed orders to the relevant supplier (referenced via `product.supplierProductId` in Sanity and `order_items.supplier_product_id` in Supabase). Do not build supplier API integration code without an explicit decision to begin that v2 work — see `PRD.md` and `BUSINESS_RULES.md` rule #24.

## Vercel (deployment)

See `DEPLOYMENT.md` for setup detail. No runtime integration code — purely a hosting/deployment concern.
