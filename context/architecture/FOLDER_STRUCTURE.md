# Gifvtme — Folder Structure

## Top-level

```
gifvtme/
  app/                  app pages
  components/           shared components
  lib/                  non-component logic
  types
  hooks
  sanity/               Sanity Studio schema (schemaTypes/)
  context/              this context file system
  public/               static assets
  gifvtme_migration.sql        Supabase migration 001 (core schema)
  gifvtme_migration_002.sql    Supabase migration 002 (e-commerce additions)
  tailwind.config.js
  next.config.js
  tsconfig.json
  .env.local.example
```

## `/app` — Next.js App Router

Routes are organized by audience, not by feature. This matters: an agent adding a new page should ask "who is this for" before deciding where it goes.

```
app/
  page.tsx                      home page (public)
  layout.tsx                    root layout

  auth/                         public — sign in/up, not yet authenticated
    login/, signup/, verify/, callback/

  shop/[slug]/                  public — e-commerce category browsing
  occasions/[slug]/              public — gift museum, occasion level
  collections/[slug]/            public — gift museum, collection level
  product/[slug]/                public — catalog product detail
  cart/                          public until checkout requires auth
  checkout/                      requires auth
  flash-sale/                    public

  w/[id]/                       PUBLIC GIVER-FACING — shared wishlist
    item/[itemId]/                item detail from a giver's perspective
    confirm/[itemId]/             "did you complete your purchase" (external flow only)

  dashboard/                     requires auth — RECEIVER-FACING
    wishlists/, wishlists/new/, wishlists/[id]/edit/
    occasions/, occasions/new/, occasions/[id]/
    dates/                        important dates (Flow 1 reminders)
    orders/[id]/                  receiver's own order history
    settings/

  account/                      requires auth — buyer-facing account area
    orders/[id]/, addresses/, profile/

  api/                          route handlers — see API_ROUTES.md
```

**Naming convention:** route folders use kebab-case (`flash-sale`, not `flashSale`). Dynamic segments use `[id]`/`[slug]` matching the underlying identifier type — `[slug]` for Sanity-slugged content, `[id]` for UUIDs or tokens.

## `components` — shared component library

Organized by domain, not by page. **Do not create page-specific component folders** (e.g. no `components/dashboard-wishlists/`) — if a component is only used in one place, it can live colocated with that route, but anything reused goes in one of these domain folders.

```
components/
  ui/            generic primitives: Button, Badge, PriceDisplay, QuantityStepper
  layout/        Navbar, Footer, MobileBottomNav, PageWrapper
  product/       ProductCard, ProductGrid, (ProductDetail, VariantSelector — to be added)
  cart/          CartItem, CartSummary, EmptyCart
  checkout/      CheckoutForm, AddressForm, PaymentSelector, OrderSummaryPanel
  order/         OrderCard, OrderList, OrderTracking, OrderStatusBadge
  wishlist/      WishlistItem, WishlistGrid, SharedWishlistHeader, ClaimedBadge
  review/        ReviewCard, ReviewsList, StarRating, RatingBreakdown
  flash-sale/    FlashSaleBanner, FlashSaleTimer
  occasion/      occasion-museum-specific display components
  reminders/     reminder opt-in UI components
  shared/        cross-domain components that don't fit elsewhere
```

**The one component, responsive variants rule:** components in this library should handle both mobile and desktop layouts internally via Tailwind responsive classes (see `Navbar.tsx` for an example — one component, different markup shown/hidden by breakpoint). Do not create `ProductCardMobile.tsx` and `ProductCardDesktop.tsx` as separate files. See `design/COMPONENT_LIBRARY.md`.

## `lib` — non-component logic

```
lib/
  supabase/      client.ts (browser), server.ts (server components/routes), middleware.ts
  sanity/        client.ts, queries.ts (all GROQ queries live here, not inline in pages)
  affiliate/     transform.ts — affiliate URL building per retailer
  scraper/       microlink.ts — URL metadata extraction
  flutterwave/   payment initiation + webhook verification (to be built)
  email/         reminders.ts and other Resend-triggering logic
  orders/        order status transition helpers (to be built)
  reviews/       verified-purchase gating logic (to be built)
  utils.ts       cn(), formatPrice(), formatCountdown(), daysUntil(), pluralize(), wishlistUrl()
```

**Rule:** any GROQ query string lives in `lib/sanity/queries.ts`, never written inline inside a page or component. Any Supabase query that's reused across more than one route should be extracted into a `lib/` helper rather than duplicated.

## `types`

`database.ts` — hand-maintained TypeScript types mirroring the Supabase schema. Should be regenerated with `npx supabase gen types typescript --linked` whenever a migration changes, then spot-checked against this file.

## `hooks`

Client-side React hooks. Currently `useUser.ts`. Keep hooks here even if only used in one component, for discoverability.

## `sanity/schemaTypes`

One file per document/object type (`product.ts`, `collection.ts`, `occasion.ts`, `supplier.ts`, and the variant objects `attributeOption.ts`, `variantAttribute.ts`, `productVariant.ts`), aggregated in `index.ts`. Naming matches the Sanity `name` field exactly.
