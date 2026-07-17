---
title: Never Modify Design Tokens
impact: CRITICAL
impactDescription: Theme token changes affect the entire application
tags: tokens, design-tokens, theme-css, modification, forbidden
---

## Never Modify Design Tokens

Never modify the Tailwind v4 `@theme` CSS token definitions in `app/globals.css` without explicit approval. Approved token changes must also update `context/design/DESIGN_SYSTEM.md` so the documented design contract stays aligned.

**Why this matters:**

- Token changes affect the entire application
- Unauthorized changes break visual consistency
- Token modifications require design review

**Incorrect (modifying tokens):**

```css
/* DON'T: Adding ad hoc colors to app/globals.css */
@theme {
  --color-promo: #ff5500; /* FORBIDDEN */
}

/* DON'T: Changing existing brand tokens without approval */
@theme {
  --color-brand: #123456; /* FORBIDDEN */
}

/* DON'T: Adding one-off spacing or typography tokens */
@theme {
  --spacing-card-gap: 13px; /* FORBIDDEN */
}
```

**Correct (requesting token changes):**

If a new token is needed, escalate first. Use existing `@theme` tokens and standard Tailwind utilities that are closest to the requirement until the new token is approved and added.

When escalating:

1. Document the use case and rationale
2. Wait for approval before editing `app/globals.css`
3. Update `context/design/DESIGN_SYSTEM.md` in the same change as any approved token edit

**Protected files:**

- `app/globals.css` `@theme` definitions
- `context/design/DESIGN_SYSTEM.md`
