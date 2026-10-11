# Gifvtme — Project Overview

Read this file first. It orients you to what Gifvtme is before you touch any code.

## What Gifvtme is

Gifvtme is a gifting platform, a gift museum, and an e-commerce platform, built as one product. It is not three separate apps stitched together — it is a single coherent experience with two genuinely different transaction models living side by side. Understanding that duality is the single most important thing to internalize before writing any code in this codebase.

In one sentence: people create wishlists for life occasions (birthdays, weddings, anniversaries), share them with friends and family, and those friends either buy the gift from wherever it's listed online (an affiliate redirect, no money touches Gifvtme) or buy it from Gifvtme's own curated dropshipping catalog (a full checkout, Gifvtme handles payment and fulfillment coordination).

## The three user types

**The receiver** (e.g. "Sarah") is the core user the product is designed around. She creates wishlists, manages occasions, and receives gifts. Everything in the product prioritizes her experience first — see `PRD.md` for why this was chosen over a giver-first or coordinator-first model.

**The giver** is anyone who lands on a shared wishlist link and buys something. Givers must create an account before marking an item purchased (this enables the thank-you message system) but the flow is designed to be as frictionless as possible otherwise.

**Internal operations** is the small team that manually reviews and forwards orders to suppliers, updates order status in Retool, and curates the product catalog and editorial collections in Sanity. There is no custom admin dashboard in v1 — Retool is the operational interface.

## The core architectural fact to never forget

Every wishlist item has an `origin` field: `external` or `catalog`. This single field determines which of two completely separate code paths an item follows:

- **External origin**: item was scraped from a URL anywhere on the internet via Microlink. No price is enforced by Gifvtme. Purchase happens via affiliate redirect to the original store. No Flutterwave, no order record, just a `purchases` row marking it claimed.
- **Catalog origin**: item exists in Gifvtme's own Sanity-managed product catalog, sourced via dropshipping suppliers (Spocket/CJDropshipping). Purchase happens through Gifvtme's own checkout, paid via Flutterwave, fulfilled manually by the internal team, tracked through a full `orders` → `order_items` → `order_status_history` lifecycle.

If you are touching purchase logic, checkout logic, or pricing logic, you must know which of these two paths you're in. Mixing them is the most likely way to introduce a serious bug in this codebase.

## v1 scope (what exists or is being built right now)

Wishlist creation (evergreen + occasion-specific, pulling from each other), URL scraping, affiliate redirects, the Gifvtme product catalog and gift museum (occasion → collection → product), flash sales, cart and checkout via Flutterwave, manual order tracking via Retool, reminders (two flows, 14-day and 3-day notice), automated + personal thank-you messages, reviews from verified purchasers only, three-tier wishlist sharing (private/friends-family/public).

## Explicitly NOT in v1 (do not build these without being asked)

Group gifting payment flows (the data model is reserved but must never be wired to a live payment), any in-app wallet or stored balance, a custom admin dashboard (Retool is intentional), native mobile apps, multi-currency support (Naira only), automated supplier API integration (order forwarding is manual), any social feed feature.

## Timeline context

This is being built by a single solo developer over a 4-month window. Every architectural decision in this project — Retool instead of a custom admin, deferring group gifting payments, manual order review instead of supplier API integration — was made specifically to fit this constraint. If you are asked to add scope, flag the timeline tradeoff rather than silently absorbing the complexity.

## Where to go next

- Why decisions were made the way they were → `PRD.md`
- Invariants that must never be violated → `BUSINESS_RULES.md`
- How the system fits together → `architecture/ARCHITECTURE.md`
- Database structure → `architecture/DATABASE_SCHEMA.md`
- Visual design rules → `design/DESIGN_SYSTEM.md`
- Current build status → `ROADMAP.md`
