---
title: Use Existing @theme CSS Tokens
impact: CRITICAL
impactDescription: Ensures visual consistency, enables global updates
tags: tokens, design-tokens, tailwind, colors, spacing, consistency
---

## Use Existing @theme CSS Tokens

Only use color, font, and other project theme values exposed through the Tailwind v4 `@theme` block in `app/globals.css`. Treat `context/design/DESIGN_SYSTEM.md` as the human-readable design contract for those CSS tokens.

**Token categories available:**

- **Colors**: `brand`, `brand-dark`, `brand-light`, `ink`, `muted`, `surface`
- **Font family**: `font-sans` via `--font-sans`
- **Shape**: use the documented Tailwind radius choices (`rounded-full`, `rounded-2xl`, `rounded-xl`)
- **Spacing and type scale**: use Tailwind's standard spacing and font-size utilities unless the design system documents a project token

**Incorrect (using non-token values):**

```tsx
// DON'T: Using arbitrary hex colors
<div className="bg-[#1a1a1a] text-[#939393]">Content</div>

// DON'T: Using non-standard spacing
<div className="p-[13px] m-[7px]">Content</div>

// DON'T: Using arbitrary font sizes
<span className="text-[15px]">Text</span>
```

**Correct (using design tokens):**

```tsx
// DO: Use token-based colors
<div className="bg-brand-light text-brand">Content</div>
<p className="text-muted">Secondary copy</p>

// DO: Use token-based spacing
<div className="m-2 p-4">Content</div>

// DO: Use documented shape and typography utilities
<section className="rounded-2xl bg-surface p-6 text-sm">Content</section>
```

**Token reference locations:**

- Source of truth: `app/globals.css` `@theme`
- Design contract: `context/design/DESIGN_SYSTEM.md`
- Tailwind v4 convention: `context/engineering/CODING_STANDARDS.md`
