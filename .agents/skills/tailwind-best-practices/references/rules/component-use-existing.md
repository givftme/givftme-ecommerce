---
title: Use Existing Gifvtme Components
impact: CRITICAL
impactDescription: Prevents component duplication, ensures consistency
tags: components, ui-primitives, design-system, gifvtme, reuse
---

## Use Existing Gifvtme Components

Always check `components/ui/` and the relevant `components/<domain>/` folder before creating a new component. Place reusable primitives in `components/ui/`, domain components in their matching domain folder, and one-off route-only pieces near the route.

**Why this matters:**

- Prevents component proliferation and duplication
- Ensures accessibility patterns are reused
- Maintains visual consistency across the application
- Reduces maintenance burden

**Incorrect (creating a new button component):**

```tsx
// DON'T: Creating a custom button in your feature
function MyFeature() {
  return <button className="rounded-md bg-red-500 px-3 py-2 text-white">Click me</button>;
}

// DON'T: Creating a duplicate primitive in a feature folder
// components/wishlist/MyNewButton.tsx
export function MyNewButton({ children }) {
  return <button className="...">{children}</button>;
}
```

**Correct (using existing Gifvtme components):**

```tsx
import { Button } from "@/components/ui/Button";

function MyFeature() {
  return <Button variant="filled">Click me</Button>;
}
```

**Available Gifvtme components include:**

- Primitives in `components/ui/`: `Button`, `Badge`, `PriceDisplay`, `QuantityStepper`, `Input`, `Form`, `Sheet`, `Dialog`, `Textarea`, `Skeleton`, `Toast`
- Layout components in `components/layout/`: `Navbar`, `Footer`, `MobileBottomNav`, `PageWrapper`
- Domain components in `components/product/`, `components/wishlist/`, `components/occasion/`, and other domain folders
