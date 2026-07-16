# Gifvtme — Design System

Source of truth: the Figma style guide screens reviewed during design (color scheme, typography, button, bottom nav exports). With shadcn/ui + Tailwind v4 in the stack, these tokens should be expressed as CSS variables in the `@theme` block of `src/styles/globals.css` (Tailwind v4's CSS-first config), which both shadcn's components and custom components reference — rather than only living in `tailwind.config.js`.

## Colors

| Token | Value | CSS variable / Tailwind class | Usage |
|---|---|---|---|
| Brand / primary | `#C50404` | `--color-brand` / `brand` | Primary buttons, active states, links, brand mark |
| Brand dark | `#A80303` | `--color-brand-dark` / `brand-dark` | Hover state on filled buttons |
| Brand light | `#FEF2F2` | `--color-brand-light` / `brand-light` | Badge backgrounds, subtle highlights, ghost button hover |
| Ink | `#000000` | `--color-ink` / `ink` | Primary text |
| Muted | `#4A4A4A` | `--color-muted` / `muted` | Secondary text, captions, placeholder text |
| Surface | `#F7F7F7` | `--color-surface` / `surface` | Card backgrounds, subtle section backgrounds, disabled states |
| White | `#FFFFFF` | (default) | Page background, card background |

shadcn/ui's own semantic tokens (`primary`, `secondary`, `muted`, `destructive`, etc., normally defined in its generated `globals.css` block) should be mapped onto these brand values — e.g. shadcn's `--primary` should resolve to the brand red, not shadcn's default. Do this mapping once in the `@theme` block rather than overriding color props component-by-component.

There is no blue, green, or other accent color in the core palette beyond what shadcn requires for semantic states (e.g. `destructive` for delete actions) — use sparingly and only for system feedback, not branding.

## Typography

**Font:** Inter, loaded via `next/font/google` in `app/layout.tsx` as the `--font-sans` CSS variable.

Heading sizes follow the Figma type scale (H1–H6); body copy uses the `xxs`–`large` scale. Default to Tailwind's standard scale (`text-sm`, `text-base`, `text-lg`, etc.) rather than inventing custom pixel values.

## Shape & spacing

**Buttons:** fully pill-shaped — `rounded-full`, never a smaller radius. shadcn's default `button.tsx` ships with `rounded-md` — this must be overridden to `rounded-full` when the component is generated/customized, not left at the shadcn default.

**Cards:** `rounded-2xl` (~16px) standard for product cards, wishlist item cards, content cards. `rounded-xl` (~12px) for smaller elements.

**Inputs:** `rounded-xl`, border `border-stone-200` (or shadcn's input border token once themed), focus ring in brand color at low opacity.

## Buttons — three variants, via shadcn

The shadcn `button.tsx` component's built-in `variant` prop should be extended/remapped to express the three Gifvtme variants rather than maintaining a fully separate custom `Button` component:

- **filled** → shadcn's `default` variant, restyled to `bg-brand text-white hover:bg-brand-dark`
- **ghost** → shadcn's `outline` variant, restyled with a `1.5px` brand border and brand text, hover fills `brand-light`
- **text** → shadcn's `ghost` variant (naming collision with our "ghost" — be careful: our "ghost" = shadcn's `outline`, our "text" = shadcn's `ghost`), restyled to brand-colored text only

Document this mapping clearly in code comments on the customized `button.tsx` to avoid confusion from the naming overlap. An earlier-built standalone `components/ui/Button.tsx` predates this shadcn decision — reconcile it into the shadcn-based component rather than keeping both in parallel; see `engineering/CODING_STANDARDS.md`.

Three sizes (`sm`/`md`/`lg`, or shadcn's `sm`/`default`/`lg` renamed to match) — default to the middle size unless context calls for otherwise.

## Icons

lucide-react exclusively, for both custom components and inside shadcn components (shadcn defaults to lucide-react already, which is part of why it pairs well with this stack — no icon library mismatch to resolve).

## Navigation

**Desktop:** full horizontal navbar — logo, search bar, account/cart icons in a white top bar, with a secondary red (`bg-brand`) nav row beneath containing Home / Shop / Occasions / Wishlist / Contact Us links.

**Mobile:** collapses to a logo + cart + hamburger menu in the top bar. Bottom tab bar with exactly three tabs: **Home, Wishlist, Account.** No Feed tab — see `PROJECT_OVERVIEW.md`.

## Currency formatting

Always `₦` prefix with comma-separated thousands, via `formatPrice()` in `lib/utils.ts`. Never display a `$`, `Rp`, `Rs.`, or `#` placeholder symbol.

## Status & badges

Badge variants: `default` (brand-light bg, brand text — "Available"), `success` (sparingly, e.g. delivered confirmations), `danger`, `muted` ("Claimed"/inactive), `sale` (solid brand background, white text — flash sale tags). If using shadcn's `badge.tsx`, theme its variants to match this list rather than introducing a parallel custom badge component.

## Motion

GSAP-driven entrance/scroll animations should feel restrained and purposeful — subtle fades and slides, not bouncy or playful easing, consistent with the warm-but-premium gift museum positioning. Avoid GSAP for simple hover/focus states; use Tailwind transitions there instead (see `engineering/CODING_STANDARDS.md`).

## Imagery and content tone

Hero and onboarding imagery should reflect warmth and real family/relationship moments rather than generic stock photography or staged e-commerce product shots. This applies to marketing surfaces, not product photography itself (sourced from suppliers via Sanity).