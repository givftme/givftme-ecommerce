# Sanity content

## Overview

This directory owns catalog content schemas and shared Sanity utilities. The Studio is embedded at `/studio`; transactional records belong to the separate Supabase integration.

## Key files

| File | Owns |
|---|---|
| `../sanity.config.ts` | Studio configuration and `/studio` base path |
| `schemaTypes/index.ts` | Registered document and object types |
| `schemaTypes/product.ts` | Product content, variants, and sale fields |
| `schemaTypes/productVariant.ts` | Variant combination keys and prices |
| `lib/client.ts` | Shared content client |
| `../lib/sanity/queries.ts` | Storefront GROQ queries |
| `../lib/sanity/types.ts` | Storefront result types |
| `../lib/sanity/catalog.ts` | Display normalization |

## Conventions

You can register schema exports through `schemaTypes/index.ts`. Existing products refer to suppliers and collections, while variant objects carry a stable `combinationKey` and selected options.

You can check the query projections, result types, and normalization helpers together when changing a schema field used by the storefront. GROQ stays in `lib/sanity/queries.ts` at the repository root.

## Gotchas

The content client lives at `sanity/lib/client.ts`, while storefront queries and adapters live at `lib/sanity/`. These are distinct directories.

The Studio shares the application package and build. `lib/sanity/fetch.ts` provides the storefront fetch wrapper. Checkout has its own authoritative pricing helper in `lib/flutterwave/getActivePrice.ts`.

## Related context

See [domain context](../lib/AGENTS.md), [catalog adapters](../lib/sanity/catalog.ts), and [checkout pricing](../lib/flutterwave/getActivePrice.ts). Root [AGENTS.md](../AGENTS.md) records the unresolved pricing conflict found before the context folder was removed.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
