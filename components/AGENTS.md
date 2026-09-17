# Shared components

## Overview

This directory groups reusable UI by domain. You can find generic primitives in `ui/` and interactive feature controllers alongside the components they coordinate.

## Key files

| File | Owns |
|---|---|
| `ui/Button.tsx` | Shared button variants |
| `ui/Form.tsx` | Form field composition |
| `ui/PriceDisplay.tsx` | Price presentation |
| `cart/CartContext.tsx` | Cart state and persistence |
| `layout/PublicPageShell.tsx` | Cart and toast providers for public pages |
| `checkout/CheckoutForm.tsx` | Checkout interaction and price change confirmation |

## Conventions

You can compose the existing primitives and merge class overrides with `cn()` from `lib/utils.ts`. Existing files use PascalCase names, so you can check the actual import path before adding a primitive.

You can reuse shared domain validation with React Hook Form and Zod resolvers. Keep interactive state in the smallest practical client component. One responsive component handles both mobile and desktop layouts.

## Gotchas

Cart state persists in localStorage. A cart line is identified by `catalog_product_id` and `combination_key`; quantities are clamped to 1 through 99. The cart represents catalog products only.

The root app layout does not install cart or toast providers. You can check the enclosing page shell before using either context. Persisted cart prices are display data, while checkout computes the charge on the server.

## Related context

See [UI registry](../ui-registry.md), [application context](../app/AGENTS.md), and [checkout handler](../app/api/checkout/route.ts).

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
