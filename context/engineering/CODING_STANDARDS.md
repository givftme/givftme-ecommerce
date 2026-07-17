# Gifvtme — Coding Standards

## TypeScript

Strict mode is enabled (`tsconfig.json`). Avoid `any` — if a Sanity or Supabase query result's shape isn't already typed, define an interface (see `ProductCardData` in `components/product/ProductCard.tsx` for the pattern) rather than reaching for `any` to move faster. Database types live in `src/types/database.ts` and should be the source of truth for any Supabase row shape — import from there rather than redefining row types ad hoc.

## Import paths

Use the `@/` alias (configured in `tsconfig.json`) for all internal imports — `@/components/ui/button`, `@/lib/utils`, etc. Never use deep relative paths like `../../../lib/utils`.

## Server vs client components

Default to server components. Only add `"use client"` to a file when it genuinely needs interactivity (state, effects, event handlers, browser APIs, GSAP animations). When a page needs one interactive piece (e.g. a quantity stepper), extract just that piece into its own client component rather than marking the entire page client.

Supabase client usage follows the same split: `lib/supabase/client.ts` (browser, for client components) vs `lib/supabase/server.ts` (server components and route handlers) vs the service-role variant in the same file (only for system-triggered actions that intentionally bypass RLS — see `AUTH_AND_PERMISSIONS.md`).

## UI components — shadcn/ui

Base interactive primitives (button, input, dialog, sheet, select, checkbox, tabs, etc.) should be sourced from shadcn/ui rather than hand-rolled. Run `npx shadcn add <component>` to bring a primitive into `components/ui/` — this generates the component source directly into the repo (shadcn is not an npm dependency in the traditional sense, the code lives in-repo and is meant to be edited).

Gifvtme-specific styling (brand colors, pill-shaped buttons, the three button variants) is applied by customizing the generated shadcn component to match `design/DESIGN_SYSTEM.md` — do not leave shadcn's default styling untouched if it conflicts with the design system. The existing custom `Button`/`Badge`/`PriceDisplay` components built before this stack decision should be reconciled with shadcn equivalents (e.g. `Button` should become a themed wrapper around or replacement for shadcn's `button.tsx`) rather than maintained as a fully parallel system — flag this reconciliation in `ROADMAP.md` if not yet done.

Domain-specific composite components (`ProductCard`, `OrderTracking`, `WishlistItem`, etc.) are still custom-built in `components/<domain>/`, composing shadcn primitives internally where applicable.

## Icons

lucide-react exclusively. Do not mix in another icon library or inline SVGs for anything that has a lucide equivalent.

## Tailwind CSS v4

Tailwind v4 uses CSS-first configuration — theme tokens (brand colors, fonts, border radii) are defined via `@theme` in the global CSS file rather than (or in addition to) `tailwind.config.js`. When adding or changing a design token, check `app/globals.css` for the `@theme` block first; `tailwind.config.js` may only hold content paths and plugin config under v4, depending on how the project's config was migrated. Keep `design/DESIGN_SYSTEM.md` in sync with whichever location is authoritative.

Use the `cn()` utility (`lib/utils.ts`, wraps `clsx` + `tailwind-merge`) whenever a component accepts a `className` prop that needs to merge with internal conditional classes.

## Forms — react-hook-form + Zod

All forms (wishlist creation, occasion creation, checkout/shipping, auth) use `react-hook-form` with a Zod schema passed via `@hookform/resolvers/zod`. Define the Zod schema near the form (or in a shared `lib/validation/` location if reused across a form and an API route — e.g. the shape used in `/api/scrape`'s request validation could be shared with a client-side form if one ever submits a URL directly). Prefer this pattern over the plain `useActionState` + manual Zod `safeParse` pattern used in earlier auth actions — that pattern predates this stack decision and should be migrated to `react-hook-form` when next touched, rather than treated as the model for new forms.

## Animation — GSAP

Use `@gsap/react`'s `useGSAP` hook inside client components for any GSAP-driven animation (entrance animations, scroll-triggered reveals, micro-interactions on the flash sale timer, etc.) rather than calling `gsap.to()`/`gsap.from()` directly in a bare `useEffect`, since `useGSAP` handles cleanup automatically. Keep animation logic scoped to the smallest client component necessary — do not wrap a whole page in a client boundary just to animate one element.

Use GSAP for genuinely complex/sequenced animation (timelines, scroll triggers, staggered reveals). For simple state-driven transitions (hover states, a badge fading in), prefer plain Tailwind transition classes — don't reach for GSAP when CSS transitions suffice.

## Naming conventions

Components: PascalCase file and export name. shadcn-generated primitives keep shadcn's own lowercase filename convention (`button.tsx`, `dialog.tsx`) inside `components/ui/` — don't rename these away from shadcn's convention, since it makes re-running `npx shadcn add` or referencing shadcn docs harder. Custom domain components keep PascalCase filenames as before. Route folders: kebab-case. Database fields: snake_case, mirrored as-is in TypeScript types.

## GROQ queries

All GROQ query strings live in `lib/sanity/queries.ts`, never written inline in a page or component file.

## Validation

Zod schemas are the single validation mechanism across both API routes and forms — a schema used to validate an API request body and a schema used to validate a form should be the same schema (imported from a shared location) wherever the same data shape applies, not redefined twice.

## Comments

Prefer a short comment explaining *why* over comments explaining *what* the code does.

## Before submitting any change touching purchases, pricing, or order status

Re-read `BUSINESS_RULES.md`.
