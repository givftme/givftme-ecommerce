# Responsive Design Directive

**Project:** Gifvtme
**Purpose:** This document tells AI agents how to handle responsive design when only mobile UI designs are available. Attach this to every feature prompt alongside the mobile screenshots.

---

## The Situation

The UI designs provided are mobile-first screens (375px width, iPhone form factor). There are no separate desktop designs. Your job is to:

1. Implement the mobile UI **exactly** as shown in the reference screenshots
2. **Intelligently adapt** the layout for tablet (768px+) and desktop (1280px+) using the rules in this document
3. Never stretch a mobile layout across a full desktop screen — that is always wrong

---

## Core Principle

> Mobile screens are the source of truth for components, colors, typography, and interactions. Desktop layouts are an **intelligent expansion** of those same components — more columns, wider containers, side-by-side panels — never a different design language.

---

## Breakpoint System

Use these Tailwind breakpoints consistently across the entire project:

| Breakpoint | Prefix | Width | Target device |
|---|---|---|---|
| Mobile | (default, no prefix) | 0–767px | iPhone, Android phones |
| Tablet | `md:` | 768px–1279px | iPad, small laptops |
| Desktop | `lg:` | 1280px+ | Laptops, desktop monitors |

---

## Layout Adaptation Rules

### Rule 1 — Container width

Mobile designs fill the full screen width. On desktop, content should be contained:

```tsx
// Wrap all page content in this container
<div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
  {children}
</div>
```

Never let content stretch to full viewport width on desktop. Always use `max-w-7xl` (1280px) as the outer container.

### Rule 2 — Single column → multi-column

Mobile layouts are always single column. Expand to multiple columns on desktop:

| Mobile | Tablet `md:` | Desktop `lg:` |
|---|---|---|
| 1 column | 2 columns | 3–4 columns |
| Full-width card | 2 cards per row | 3–4 cards per row |
| Stacked form + summary | Side-by-side (form left, summary right) |
| Stacked sections | Side-by-side sections |

**Product grid example:**
```tsx
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6">
```

**Dashboard layout example:**
```tsx
// Mobile: no sidebar, full width content
// Desktop: fixed sidebar left, content right
<div className="flex flex-col md:flex-row min-h-screen">
  <aside className="hidden md:block w-64 flex-shrink-0 border-r border-stone-100">
    {/* Sidebar nav */}
  </aside>
  <main className="flex-1 px-4 md:px-8 py-6">
    {children}
  </main>
</div>
```

### Rule 3 — Navigation

The mobile designs use a bottom tab bar (`MobileBottomNav`). On desktop, hide the bottom nav and show a top horizontal navbar instead.

```tsx
{/* Top navbar — desktop only */}
<Navbar className="hidden md:block" />

{/* Bottom tab bar — mobile only */}
<MobileBottomNav className="flex md:hidden" />
```

The desktop navbar already exists in the project (`components/layout/Navbar.tsx`). Use it.

### Rule 4 — Sheets and modals

Mobile designs use full-screen sheets (sliding up from the bottom) for forms and detail views. On desktop, these become centered dialogs or side panels.

```tsx
// Use shadcn/ui Sheet with responsive behavior
<Sheet>
  <SheetContent
    side="bottom"           // mobile: slides up from bottom
    className="md:max-w-lg md:mx-auto md:rounded-t-2xl" // tablet: centered, rounded
  >
    {content}
  </SheetContent>
</Sheet>
```

For larger forms (checkout, occasion creation), use a full Dialog on desktop:

```tsx
// On mobile: full-screen sheet
// On desktop: centered modal dialog (max-width 600px)
const isMobile = useMediaQuery('(max-width: 767px)')

return isMobile ? (
  <Sheet open={open} onOpenChange={setOpen}>
    <SheetContent side="bottom">{form}</SheetContent>
  </Sheet>
) : (
  <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="max-w-lg">{form}</DialogContent>
  </Dialog>
)
```

### Rule 5 — Typography scaling

Mobile designs use specific font sizes. Scale up proportionally on desktop:

| Element | Mobile | Desktop (`lg:`) |
|---|---|---|
| Page title (H1) | `text-xl` (20px) | `lg:text-3xl` (30px) |
| Section title (H2) | `text-lg` (18px) | `lg:text-2xl` (24px) |
| Card title | `text-sm` (14px) | `lg:text-base` (16px) |
| Body text | `text-sm` (14px) | `lg:text-base` (16px) |
| Caption / meta | `text-xs` (12px) | `lg:text-sm` (14px) |

### Rule 6 — Spacing and padding

Mobile has tight spacing. Desktop has room to breathe:

```tsx
// Vertical section spacing
<section className="py-8 md:py-12 lg:py-16">

// Card padding
<div className="p-3 md:p-4 lg:p-6">

// Gap between grid items
<div className="gap-3 md:gap-4 lg:gap-6">
```

### Rule 7 — Forms

Mobile forms are full-width, single column. Desktop forms use two columns where it makes sense:

```tsx
// Two-column form layout on desktop
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <FormField name="first_name" />  {/* left column */}
  <FormField name="last_name" />   {/* right column */}
</div>
<FormField name="email" />         {/* full width */}
<FormField name="address" />       {/* full width */}
```

Checkout forms specifically: on desktop, split into left panel (form fields) and right panel (order summary), side by side.

### Rule 8 — Auth screens

Auth screens in the mobile design are full-screen vertical layouts. On desktop, they should be a **split two-panel layout**:

```tsx
// Desktop auth layout
<div className="min-h-screen flex">
  {/* Left panel: brand/marketing (hidden on mobile) */}
  <div className="hidden md:flex flex-col w-1/2 bg-[#C50404] p-12 justify-between">
    <div className="text-white text-2xl font-bold">givftme</div>
    <div>
      <p className="text-white text-4xl font-semibold leading-tight">
        Gifting that actually<br />feels personal.
      </p>
    </div>
    <div className="flex flex-wrap gap-2">
      {/* Occasion pills */}
    </div>
  </div>
  {/* Right panel: the form (full screen on mobile) */}
  <div className="flex-1 flex items-center justify-center p-8">
    <div className="w-full max-w-sm">
      {form}
    </div>
  </div>
</div>
```

### Rule 9 — Wishlist and occasion detail pages

Mobile: single column, items stacked vertically.
Desktop: wider content area with a sticky sidebar for actions.

```tsx
<div className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto px-4 lg:px-8">
  {/* Main content: item list */}
  <div className="flex-1">
    {itemList}
  </div>
  {/* Sidebar: wishlist settings, share options (desktop only) */}
  <aside className="hidden lg:block w-72 flex-shrink-0">
    {wishlistActions}
  </aside>
</div>
```

### Rule 10 — Product grid pages (shop, collections, search)

```
Mobile:  2 columns
Tablet:  3 columns
Desktop: 4 columns
```

This is already set in `ProductGrid.tsx` — do not change it.

---

## Specific Screen Rules

### Onboarding screens
- **Mobile:** Full screen, image top half, content bottom half
- **Desktop:** Center a card (max-width 400px) on a brand-red background. The card shows image + content. Same interactions as mobile.

```tsx
// Desktop onboarding wrapper
<div className="hidden md:flex min-h-screen bg-[#C50404] items-center justify-center">
  <div className="bg-white rounded-3xl overflow-hidden w-96 shadow-2xl">
    {onboardingCard}
  </div>
</div>
// Mobile onboarding wrapper
<div className="flex md:hidden flex-col min-h-screen">
  {fullScreenSlide}
</div>
```

### Dashboard (`/wishlists`)
- **Mobile:** Single column, stacked cards, bottom tab nav
- **Desktop:** Left sidebar (64px icon-only OR 240px expanded) with nav links, content area on the right

### Occasion creation (3-step flow)
- **Mobile:** Full-screen steps, each replacing the previous
- **Desktop:** Center a 600px card on a light grey background. Step indicator at top of card. Same 3-step flow but contained in the card.

### Product detail page
- **Mobile:** Stacked: images → info → CTAs → description → reviews
- **Desktop:** Two-column: left column = image gallery (sticky), right column = product info + CTAs. Below: full-width description + reviews tabs.

### Cart page
- **Mobile:** Stacked item cards, sticky bottom checkout button
- **Desktop:** Left column = item list (table layout with image, name, variant, price, quantity, total, remove). Right column = order summary + checkout button (sticky).

### Shared wishlist view (`/w/[id]`)
- **Mobile:** Single column item cards, sticky reminder CTA at bottom
- **Desktop:** Center content at max-width 680px. Two-column item grid (2 cards per row). Sticky sidebar on the right with the reminder opt-in and receiver info.

---

## What Never Changes Between Mobile and Desktop

These things are **identical** regardless of screen size — do not change them:

- Brand colors (`#C50404`, `#FEF2F2`, `#4A4A4A`, `#F7F7F7`)
- Font (Inter)
- Button shape (always `rounded-full` pill)
- Card border radius (`rounded-2xl`)
- Input border radius (`rounded-xl`)
- All interaction behaviors (tap/click, hover states, animations)
- GSAP animations (same animations, just triggered on a wider canvas)
- All text copy — never change copy between breakpoints
- Error messages and validation behavior
- Loading and empty states

---

## Component Checklist

When implementing any component, run through this checklist:

- [ ] Does it look correct at 375px (iPhone)? ← primary reference (match the screenshots)
- [ ] Does it look correct at 768px (iPad)? ← no horizontal scrolling, no stretched elements
- [ ] Does it look correct at 1280px (laptop)? ← uses available space well, not a stretched mobile
- [ ] Is the bottom tab nav hidden on desktop?
- [ ] Is the top navbar shown on desktop?
- [ ] Are full-screen sheets replaced with centered dialogs on desktop?
- [ ] Does text scale up appropriately on desktop?
- [ ] Does the grid expand to more columns on desktop?
- [ ] Is max-width applied on desktop so content doesn't stretch to 1920px?

---

## How to Use This Document

When giving an agent a feature spec:

1. Attach the mobile UI screenshots from the Figma exports
2. Attach the relevant feature spec (e.g. `EVERGREEN_WISHLIST_SPEC.md`)
3. Attach this document (`RESPONSIVE_DESIGN_DIRECTIVE.md`)
4. Tell the agent:

> "Implement the UI exactly as shown in the mobile screenshots. Then apply the rules in `RESPONSIVE_DESIGN_DIRECTIVE.md` to make it work correctly on desktop and tablet. The mobile screenshots are the source of truth for design decisions. The responsive directive is the source of truth for desktop adaptation."

---

## Example Prompt Template

```
Implement the [Feature Name] feature for Gifvtme.

Reference files:
- Feature spec: [FEATURE_SPEC.md]
- Mobile UI reference: [screenshot-1.png, screenshot-2.png, ...]
- Responsive rules: [RESPONSIVE_DESIGN_DIRECTIVE.md]
- Design system: [context/design/DESIGN_SYSTEM.md]
- Project context: [context/AGENTS.md]

Instructions:
1. The mobile screenshots are the primary design reference — match them exactly on mobile (375px)
2. Apply the responsive rules from RESPONSIVE_DESIGN_DIRECTIVE.md for tablet and desktop
3. Use the tech stack: Next.js 16, Tailwind CSS v4, shadcn/ui, react-hook-form + Zod, GSAP + @gsap/react, lucide-react
4. Implement both UI and backend logic
5. Ask for clarification only for high-risk ambiguity involving pricing, payments, refunds, money-sensitive decisions, data visibility, or rules in `BUSINESS_RULES.md`; for lower-stakes ambiguity, do not ask for clarification — make reasonable decisions and note them in comments
```
