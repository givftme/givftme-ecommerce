# Givftme — Product Requirements & Decision Log

This file captures product decisions and, critically, the reasoning behind them. If a task seems to contradict something here, stop and flag it rather than silently overriding a decision — these were debated deliberately.

## Core user model

**Decision: receiver-first, not giver-first or coordinator-first.**

Three possible centers of gravity were considered: the receiver building a wishlist (e.g. "Sarah"), the giver buying a gift, and a group coordinator pooling money. These three users have conflicting needs — for example a receiver wants visibility into her own list, while a giver often wants the purchase to feel like a surprise.

Receiver-first was chosen because the receiver has an ongoing relationship with the platform (recurring birthdays, anniversaries, life events) while givers and coordinators are one-time visitors. Receivers also organically bring new users via shared links — the growth engine is built into the core loop, not bolted on.

## Wishlist model

**Decision: items can be added from anywhere on the internet, not just Givftme's own catalog.** This was non-negotiable for user experience — restricting Sarah to one store's catalog would make the product far less useful.

**Decision: two wishlist types — evergreen (permanent) and occasion-specific (time-bound) — and occasions can pull from the evergreen pool plus have exclusive items (Option C from the original scoping conversation).** This was chosen over two simpler alternatives (fully separate lists, or one master list with occasions as filtered views) because it gives Sarah the most natural mental model: a running wishlist she maintains, with specific events able to borrow from it.

**Decision: when an occasion archives, items pulled from evergreen that were purchased do NOT automatically revert to available, and do NOT stay silently marked purchased forever.** Instead, Sarah gets a notification asking which purchased items she wants reactivated on her evergreen list. This avoids the failure mode where an item bought as a birthday gift stays invisibly "claimed" on the evergreen list months later when she actually wants another one.

## Transaction model

**Decision: affiliate redirect for external items, full Givftme checkout for catalog items — these are two permanently separate flows, never merged into one cart.**

Originally in-house fulfillment for everything was considered and rejected — becoming a merchant of record for every external product on the internet would require automating checkout on third-party sites (most retailers actively block this, e.g. Amazon bans scripted checkout) and would make Givftme legally responsible for delivery problems on products it never touched. The affiliate model was chosen instead: redirect to the original store, mark the item claimed on return, earn commission where affiliate programs exist.

Catalog items are different — Givftme curates and owns the relationship with the product (via dropshipping suppliers), so a full checkout with Flutterwave is appropriate there.

**Decision: a customer can buy multiple catalog products in one order (proper cart + checkout), but external and catalog items can never be combined in a single checkout.** Mixing them would require either faking a price/payment for external items or building dual-path checkout logic — not worth the complexity for the UX gain.

## Catalog & gift museum

**Decision: products are curated and owned by Givftme, not a multi-seller marketplace.** This was chosen for brand control — quality and curation define the "gift museum" positioning, which a marketplace model would dilute.

**Decision: dropshipping via pre-vetted supplier networks (Spocket/CJDropshipping), not direct inventory ownership.** Keeps capital risk low for a solo-developer v1.

**Decision: orders are manually reviewed by an internal team before being forwarded to suppliers — no automated supplier API integration in v1.** This was chosen specifically because it removes the need to build supplier-side integration work before launch; it's a deliberate v1/v2 tradeoff, not a permanent architectural stance.

**Decision: museum structure is occasion → editorial collection → product, with products allowed in multiple collections (many-to-many).** Editorial collections were chosen over a flat filterable grid because gift shopping is emotionally driven ("something for my best friend's birthday") rather than spec-driven ("electronics under $50"). Filters exist as a secondary, not primary, navigation layer.

**Decision: product variants support both single-attribute (simple) and multi-attribute (complex) models in the same schema**, with the catalog team choosing per-product which to use. This avoids forcing every simple product (a candle, available in three sizes) through the complexity needed for genuinely multi-dimensional products (a shirt in 4 colors × 4 sizes).

## Catalog management

**Decision: Retool, not a custom admin dashboard, for v1 internal operations.** A proper admin dashboard (product CRUD, order management, supplier sync, analytics) is realistically a second product's worth of engineering. Retool connects directly to Supabase and lets the catalog/ops team work within days instead of weeks. Revisit this in v2 once real operational pain points are known.

**Superseded (October 2026): an internal admin dashboard at `/admin/*`** (`feature-specs/23-ADMIN-DASHBOARD-SPEC.md`). Operational pain arrived: ops, support, growth, and finance each needed their own view, and analytics needed an event log Retool couldn't provide. The dashboard is role-gated (`users.role`: support, operations, growth, finance, admin), reads an append-only `events` log, and audits every view and mutation in `admin_actions`. It covers order status changes, pool payout recording, review moderation, business enquiries, reminder failure triage, people records, and analytics screens. It does not edit catalog content (Sanity Studio still owns that) and does not automate supplier forwarding or bank transfers. Retool remains usable alongside it.

**Decision: manual order status changes never set payment states.** The admin status panel offers only the post-payment transitions from `VALID_TRANSITIONS`; `pending_payment`, `payment_failed`, and `confirmed` are set solely by the signature-verified Flutterwave webhook, so no person can record money that wasn't captured.

**Decision: lifecycle segment definitions are provisional.** The spec defers to an external document (`Givftme-07-Admin-and-Data-Layer.docx`) that isn't in this repository. The nine segments in `lib/admin/segments.ts` (mirrored in `gifvtme_admin_segment_members()`) should be checked against it.

**Decision (October 2026): business dashboard accounts are Supabase Auth users flagged `users.account_type = 'business'`** (`feature-specs/24-BUSINESS-DASHBOARD-SPEC.md`), not a separate credential store. A company is a `business_accounts` row; its HR users are `business_users` rows with a dashboard role (admin, editor, approver, limited) that is unrelated to the internal `users.role`. Signup creates the auth user, then the account, membership, flag and default rules in one SQL function, deleting the auth user if that fails. The dashboard is a single client shell with no URL per view, backed by server actions; corporate campaigns stay estimates outside the order and payment flows, fulfilled manually by ops.

**Decision: Sanity CMS for product/collection/occasion content, Supabase for everything transactional.** Sanity's studio interface is well-suited to rich editorial content (descriptions, images, collections) in a way Retool is not. The tradeoff accepted: the Next.js app queries two data sources and composes them at the page level, rather than one unified database.

## Sharing & permissions

**Decision: three visibility tiers (private, friends & family, public) plus a single price-visibility toggle — explicitly NOT item-level permissions.** Item-level permission control (different visibility per item per viewer) was considered and rejected as a "permissions matrix" — too complex to build, test, and for Sarah to actually manage day to day. The three-tier model covers the realistic use cases without that overhead.

**Decision: link previews see a wishlist exactly as a signed-out visitor would.** Shared wishlist metadata and the `/api/og/wishlist/[token]` image resolve the share key through `gifvtme_get_shared_wishlist` with an anonymous, cookieless client. Private lists, and non-public lists opened by UUID rather than by invite token, get generic metadata and the brand image, so a crawler never sees the receiver's name or items. Public metadata uses a "%s — Givftme" title template.

**Decision: the brand is spelled "Givftme".** All user-facing text, emails, metadata, the domain (`givftme.com`), the `@givftme` handle and `utm_source` tags use it. The older "gifvtme" spelling survives only in identifiers that cannot be renamed without a migration or user impact: `gifvtme_*` database functions, migration file names, the `gifvtme.*` Postgres session settings, and the browser storage keys `gifvtme.catalog-cart` and `gifvtme:pool-contribution-attempt:*` (renaming those would empty saved carts and break payment-retry idempotency). The default share image is the illustrated "Never miss the moments that matter" artwork at `public/og-default.jpg` (not the plain red card spec 22 describes); it is wired through the root metadata rather than a file-based `opengraph-image`, because the OG routes also serve it as their fallback. OG images draw inline SVG illustrations instead of emoji so rendering never depends on an external emoji CDN.

## Group gifting

**Decision: gift pooling is a separate, active v1 transaction flow.** Contributors must be signed in and pay immediately through Flutterwave. `group_gift_pools`, `pool_contributions`, and `pool_payouts` record this flow separately from external purchases and catalog orders. Cash payouts and exceptional refunds are handled manually by ops in Retool; there is no wallet or stored customer balance. Migration 032's service-only `gift_pools` ledger remains independent from this customer-facing model.

## Reminders

**Decision: two independent reminder flows.** Flow 1: the receiver is reminded about other people's upcoming occasions (a personal calendar). Flow 2: invited friends opt in to be reminded about the receiver's occasion. These are architecturally separate because they serve opposite directions of the gifting relationship and have different data sources (`important_dates` vs `wishlist_invites`).

**Decision: Flow 2 reminders require explicit opt-in, never automatic enrollment.** Chosen for both UX reasons (unsolicited reminder emails feel spammy) and compliance reasons (GDPR/CAN-SPAM implications of auto-enrolling someone in email reminders they didn't request).

**Decision: reminders fire at 14 days and 3 days before the occasion**, via email and push.

## Thank-you messages

**Decision: accounts are required for anyone marking an item purchased**, specifically to enable personalized thank-you messages — knowing exactly who bought what transforms a transactional purchase into a relational moment, which is core to the brand.

**Decision: thank-you messages are both automated (fires immediately on purchase, using a default message Sarah sets once) AND allow a personal follow-up later.** A purely automated message feels impersonal; a purely manual one creates friction Sarah might never act on. The hybrid gives the buyer immediate acknowledgment with the option of a real personal touch later.

## Flash sales & reviews

**Decision: flash sales are in v1 scope** — time-limited discounts on catalog products, requiring a sale price, start time, and end time on the product/variant model.

**Decision: reviews are collected directly on Givftme, gated to verified purchasers only.** Pulling supplier reviews was considered and rejected — reviews need to reflect the Givftme experience (including fulfillment quality) and verified-purchase gating is the only way to prevent fake/incentivized reviews.

## Currency

**Decision: Nigerian Naira (₦) only for v1.** No multi-currency support. This should be assumed everywhere price is displayed, stored, or calculated.
