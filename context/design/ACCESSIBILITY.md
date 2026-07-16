# Gifvtme — Accessibility

Thin scope for v1 given the timeline (see `PROJECT_OVERVIEW.md`), but the following are inexpensive to get right from the start and should not be skipped.

## Color contrast

The brand red `#C50404` on white passes WCAG AA for normal text at typical button sizes, but white text on `#C50404` (filled button) should be double-checked at smaller font sizes — when in doubt, keep filled-button text at `text-sm` or larger, not smaller.

`muted` (`#4A4A4A`) on white passes AA for body text. Do not introduce a lighter gray for secondary text without checking contrast first.

## Focus states

All interactive elements (buttons, links, inputs) must have a visible focus state — the `Button` component and form inputs already include `focus:ring-2 focus:ring-[#C50404]/20` or equivalent; preserve this pattern in new interactive components rather than suppressing default focus outlines without a replacement.

## Images

Product images (from Sanity) should always render with meaningful `alt` text — the Sanity image schema already includes an optional `alt` field on product images; when it's empty, fall back to the product title rather than leaving `alt=""`. Decorative-only images (e.g. background hero imagery) can use `alt=""` intentionally.

## Touch targets

Mobile buttons and tappable icons (cart icon, bottom nav items, quantity stepper buttons) should maintain a minimum ~40px touch target — the `QuantityStepper` buttons are sized at `w-9 h-9` (36px), close to this minimum; don't shrink further when adapting for tighter layouts.

## Forms

All form inputs need an associated `<label>` (see the auth signup/login pages for the pattern — `htmlFor`/`id` pairing) rather than relying on placeholder text alone as the only label.

## Semantic structure

Use real heading levels (`h1`/`h2`/etc.) in document order rather than styling a `div` to look like a heading. Use `<nav>`, `<main>`, `<footer>` landmarks as already established in `PageWrapper`/`Navbar`/`Footer` — preserve this when building new layout components.

## Not addressed yet (flag if these become a priority)

Screen reader testing, keyboard-only navigation testing end to end, and reduced-motion preferences are not yet verified against. If accessibility becomes a stated launch requirement rather than best-effort, this file should be expanded and an explicit audit pass scheduled — check `ROADMAP.md` for whether this has been prioritized.
