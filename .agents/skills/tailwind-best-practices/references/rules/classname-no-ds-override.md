---
title: Avoid className Overrides on Shared UI Primitives
impact: HIGH
impactDescription: Shared UI primitive overrides break Gifvtme visual consistency
tags: classname, ui-primitives, override, styling, design-system
---

## Avoid className Overrides on Shared UI Primitives

Prefer the variants and props exposed by `components/ui/` primitives before using `className` to override their visual styling. Use `className` for layout-level composition only when the primitive intentionally supports it.

**Why this matters:**

- Gifvtme UI primitives encode the design-system contract from `context/design/DESIGN_SYSTEM.md`
- Overriding breaks visual consistency
- Makes component updates risky
- Undermines design system integrity

**Incorrect (overriding shared primitive styles):**

```tsx
// DON'T: Override Button styles
<Button className="bg-red-500 text-white">Save</Button>

// DON'T: Override Button spacing
<Button className="p-8">Click</Button>

// DON'T: Override Badge colors
<Badge className="bg-blue-500">Status</Badge>

// DON'T: Override Input borders
<Input className="border-red-500" />
```

**Correct (use component variants):**

```tsx
// DO: Use component variants
<Button variant="filled">Save</Button>
<Button variant="ghost">Cancel</Button>
<Button variant="text">Edit</Button>

// DO: Use component size props
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>

// DO: Use component props
<Badge variant="success">Active</Badge>
<Badge variant="danger">Failed</Badge>

// DO: Use className for layout constraints when the primitive supports it
<DialogContent className="max-h-[92dvh] overflow-y-auto">
  Content
</DialogContent>
```

**Allowed exceptions:**

- Layout constraints such as `w-*`, `max-w-*`, `h-*`, `max-h-*`, overflow, grid, and flex classes
- Positional classes needed by page or domain layout
- Intentional one-off composition using brand/design tokens, not arbitrary new colors

**If you need different styles:**

1. Check if a variant exists for your use case
2. Consider if the component props support your need
3. If not, add or extend the shared primitive in `components/ui/` and update `context/design/COMPONENT_LIBRARY.md`
