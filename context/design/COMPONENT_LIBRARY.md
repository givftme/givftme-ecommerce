# Gifvtme — Component Library

This documents the shared component library in `src/components/`. Before creating a new component, check here first — there is a strong chance something close already exists and should be extended rather than duplicated. See `architecture/FOLDER_STRUCTURE.md` for the one-component-responsive-variants rule this library follows.

## `ui/` — primitives

### `Button`
Props: `variant` (`filled`|`ghost`|`text`, default `filled`), `size` (`sm`|`md`|`lg`, default `md`), `fullWidth` (boolean), plus standard `ButtonHTMLAttributes`. See `design/DESIGN_SYSTEM.md` for when to use each variant.

### `Badge`
Props: `variant` (`default`|`success`|`danger`|`muted`|`sale`, default `default`), `children`, `className`. Used for item status ("Available"/"Claimed"), order status, flash sale tags.

### `PriceDisplay`
Props: `price` (number, required), `compareAtPrice` (number, optional — renders strikethrough if present and greater than `price`), `size` (`sm`|`md`|`lg`). Always renders in Naira via `formatPrice()` — never pass a currency code.

### `QuantityStepper`
Props: `value`, `onChange`, `min` (default 0), `max` (default 99). Client component (`"use client"`). Used identically on product detail pages and cart line items — do not build a separate stepper for either context.

### `Input`
shadcn-style primitive used by auth forms and future forms. Shape is `rounded-xl`, border is `border-stone-200`, focus state is brand ring (`focus:ring-brand/20`) and brand border.

### `Form`
shadcn-style react-hook-form wrappers: `Form`, `FormField`, `FormItem`, `FormLabel`, `FormMessage`. Use these with Zod-backed `react-hook-form` forms rather than hand-rendering labels/errors.

### `Sheet`
Radix Dialog-backed bottom sheet primitive. `SheetContent` accepts `showClose` (default `true`) for screens that provide their own close/back affordance. Used for the action-gated auth prompt on mobile/public pages.

### `Dialog`
Radix Dialog-backed confirmation/modal primitive. Used by wishlist duplicate and delete confirmations.

### `Switch`
Accessible shadcn-style switch primitive with `checked` and `onCheckedChange`. Used for binary settings such as wishlist price visibility.

### `Textarea`
shadcn-style primitive for longer form fields. Matches `Input` shape (`rounded-xl`, stone border, brand focus ring).

### `Skeleton`
Simple loading placeholder primitive using `animate-pulse`, `bg-surface`, and rounded corners.

### `Toast`
Local toast provider and `useToast()` hook used for dashboard/wishlist success and error feedback.

## `layout/`

### `Navbar`
Props: `cartCount` (optional), `userName` (optional), `avatarUrl` (optional — renders as a 24px circular image in the desktop account link when set, falling back to a `userName`-initial circle, then a generic user icon). One component handling both desktop (full bar + secondary nav row) and mobile (collapsed bar + hamburger) — see the component for the `hidden md:flex` / `flex md:hidden` pattern used throughout.

### `MobileBottomNav`
No props. Renders only on mobile (`flex md:hidden`). Exactly three tabs: Home, Wishlist, Account — see `design/DESIGN_SYSTEM.md` for why Feed is intentionally absent.

### `Footer`
No props. Identical across desktop and mobile (stacks via grid responsively). Used on every public-facing page.

### `PageWrapper`
Props: `children`, `cartCount`, `userName`. Composes `Navbar` + `main` + `Footer` + `MobileBottomNav`. Wrap any new public page in this rather than assembling layout manually.

## `product/`

### `ProductCard`
Props: `product` (`ProductCardData` — see the interface in the file for exact shape, sourced from Sanity's `PRODUCT_CARD_FRAGMENT`), `onToggleWishlist` (optional callback), `isWishlisted` (optional boolean), `className`. Handles flash sale price/badge display when `product.isOnFlashSale` is true.

### `ProductGrid`
Props: `products` (array of `ProductCardData`), `onToggleWishlist`, `wishlistedIds` (`Set<string>`), `emptyMessage`. Responsive grid: 2 columns mobile, 3 tablet, 4 desktop.

### `CatalogProductGrid`
Client controller around `ProductGrid` that wires product cards to cart context and the catalog wishlist picker. Variant products route to their detail page for option selection.

### `ProductDetail`
Client product detail controller for image gallery, variants, quantity, cart/wishlist CTAs, sale timer refresh, description/reviews tabs, and product metadata.

### `ProductImageGallery`
Client image + thumbnail gallery. Uses the product image fallback when no Sanity images exist and animates thumbnail swaps with GSAP.

### `VariantSelector`
Client variant option resolver. Reads `attributes` and `variants`, requires all attributes to be selected, disables sold-out combinations, and exposes the selected combination to `ProductDetail`.

### `RatingBreakdown` / `RelatedProducts`
Read-only review summary chart and related product section used below product detail.

## `auth/`

### `AuthPageShell`
Animated full-screen mobile-first auth wrapper. Handles the red back arrow, title/subtitle spacing, centered success layout, and GSAP screen entrance.

### `OnboardingSlider`
Two-slide onboarding experience for `/onboarding`. Uses `/images/onboarding-1.jpg` and `/images/onboarding-2.jpg`, localStorage `onboarded`, GSAP horizontal transitions, dots, and mobile swipe gestures.

### `AuthWelcomePanel`
Reusable welcome/login/signup choice panel used by `/welcome` and visually matched to onboarding slide 2.

### `AuthFormInput` / `AuthFormPasswordInput`
Form-aware wrappers around `Input` and the password visibility toggle. Use inside `FormField` so labels, inputs, and messages share accessible IDs.

### `GoogleOAuthButton`
Client-side Supabase Google OAuth trigger. Preserves the `redirect` query param through `/callback`.

### `OtpDisplay` / `OtpKeypad`
Six-box OTP display and custom numeric keypad for `/verify-otp`. `OtpDisplay` owns the GSAP digit-entry and error-shake animations; `OtpKeypad` owns press feedback.

### `AuthPromptSheet`
Bottom sheet for unauthenticated protected actions. Shows "You need an account" with Login/Create account CTAs and preserves the current path in `redirect`.

## `wishlist/`

### `WishlistCard`
Dashboard summary card for the evergreen wishlist. Handles inline title editing, item count, view CTA, and share-stub toast.

### `WishlistTitleEditor`
Inline title editor shared by the dashboard card and wishlist detail header. Persists via `PATCH /api/wishlists/[id]`.

### `WishlistItemList`
Client-side controller for the wishlist detail page. Separates available and purchased items, opens add/edit sheets, handles archive/delete, and saves reorder changes.

### `WishlistItemCard`
Individual wishlist item row/card. Shows thumbnail fallback, title, price, source domain/store badge, gifted state, edit/delete actions, and reorder controls.

### `ShareSettingsSheet`
Receiver-facing sharing control surface for wishlist detail/card and occasion detail. Handles visibility auto-save, price visibility, invite list/create/delete, invite-token/public share links, copy feedback, and WhatsApp share.

### `SharedWishlistHeader`
Giver-facing red receiver header/sidebar with avatar fallback, receiver name, occasion title, and countdown.

### `SharedWishlistItem`
Giver-facing item card for `/w/[id]`. Handles available/claimed visual states, price visibility, source badges, intent warnings, and buy CTA auth routing.

### `ClaimedBadge` / `IntentFlagBadge`
Small status components for giver-facing item states. `IntentFlagBadge` uses the amber warning style and GSAP entrance.

### `SharedWishlistNotice`
Centered full-page notice used by `/w/[id]` for the private, archived-occasion, error, and not-found states — title + description + optional CTA link.

### `ReminderOptIn`
Invitee Flow 2 reminder opt-in card. Used on claimed success and backed by the invite/public opt-in APIs.

### `AuthGateSheet`
Giver-facing auth gate sheet with receiver-specific copy and redirect preservation for shared wishlist actions.

### `AddItemSheet`
Bottom sheet for adding external wishlist items via URL scrape or manual entry. Includes duplicate URL warning and Supabase Storage image upload.

### `EditItemSheet`
Bottom sheet for editing item details and archiving items.

### `EmptyWishlist`
Animated empty state used for empty and all-gifted wishlist states.

### `ReorderableList`
Light wrapper reserved for reorder list presentation. Current v1 reorder uses move up/down controls rather than `@dnd-kit`.

## `occasion/`

### `CreateOccasionForm` / `CreateOccasionStepper` / `OccasionTypeSelector` / `PullFromEvergreen`
The 3-step occasion creation flow at `/my-occasions/new`: occasion basics, pull-from-evergreen selection (with select all/clear all and an empty-evergreen skip state), then exclusive items via the shared `AddItemSheet` (`isExclusive`/`draftMode`).

### `OccasionDetailClient` / `OccasionHero` / `OccasionCard`
`/my-occasions/[id]` detail page controller (edit dialog, share, archive, add-more-items for both the pulled and exclusive sections, all-gifted banner), its header/countdown hero, and the compact summary card used in the dashboard occasions list.

### `ReactivationPrompt` / `ReactivationPromptsBanner`
`ReactivationPrompt` is the full per-item reactivate/keep-as-purchased toggle shown inline on an archived occasion's own detail page. `ReactivationPromptsBanner` is the dashboard-wide nudge on `/wishlists` linking out to each occasion with an unresolved `occasion_prompts` row — it doesn't duplicate the per-item toggle UI, just surfaces that one exists.

### `MuseumOccasionCard` / `MuseumOccasionGrid`
Public gift-museum occasion browsing cards — unrelated to the user-created occasions above; these render Sanity `occasion` documents on `/occasions`.

## `reminders/`

### `ImportantDatesClient`
Full page controller for `/dashboard/dates` (Flow 1) — owns the header + "Add a date" CTA, the list/empty state, and the standalone delete-confirmation dialog. Renders `ImportantDateCard` per saved date and `ImportantDateForm` for add/edit.

### `ImportantDateCard`
Compact summary card: occasion emoji, person name, formatted date, a colored days-to-go pill (same visual language as `OccasionCard`'s), a "Wishlist linked" badge when `linked_wishlist_id` is set, and an inline three-dot Edit/Delete menu (same pattern as `OccasionDetailClient`'s header menu — no shared `DropdownMenu` primitive exists yet).

### `ImportantDateForm`
Sheet-based add/edit form (react-hook-form + Zod via `lib/important-dates/validation.ts`), reusing `OccasionTypeSelector` for the occasion-type grid. Fields: person name, occasion type, date, "Recurs annually" switch (auto-defaults on for birthday/anniversary until the user overrides it), and an optional wishlist-link input that the server resolves to `linked_wishlist_id` via `gifvtme_get_shared_wishlist`. Includes its own delete confirmation when editing, matching `EditItemSheet`'s convention of exposing delete both from the sheet and from the card's menu.

## `gifts/`

### `GiftsClient`
Full page controller for `/gifts` — owns the header + item count badge, the All/To-thank/Thanked filter tabs (plain inline segmented buttons, no shared `Tabs` primitive exists yet — same "build it inline until it's reused a third time" call as `ImportantDateCard`'s inline menu), the list/empty state, and the `PersonalThankYouSheet`. Fires `thank_you.personal.compose_opened` at the actual click that opens the sheet, not from an effect inside the sheet (React's rule against synchronous `setState` in effects).

### `GiftCard`
Compact summary card: 60×60 item image (or a gift-icon placeholder), title, "Gifted by [name]"/"Anonymous" + purchase date, an "Auto thank-you sent ✓" muted chip once that fires, and either a ghost "Send personal thank-you" button or a "Personal thank-you sent ✓" chip.

### `PersonalThankYouSheet`
Sheet-based compose form (react-hook-form + Zod), same responsive one-component pattern as `ImportantDateForm`. Item image/title context header, read-only "To: [buyer]" line, a 1000-char textarea with counter pre-filled from the receiver's `default_thank_you_msg`, and a send CTA that POSTs to `/api/thank-you/[id]/personal` with `{ source, message }`.

## `cart/`, `checkout/`, `order/`, `review/`, `flash-sale/`

`cart/CartContext.tsx` and `cart/CartProvider.tsx` provide the v1 client-only catalog cart state and expose `isHydrated`, `items`, `addItem`, `removeItem`, `updateQuantity`, `updateItemDetails`, `clearCart`, `totalItems`, and `totalPrice`. The cart count is wired into `Navbar` through `PageWrapper`.

`cart/CartItem.tsx`, `cart/CartSummary.tsx`, `cart/EmptyCart.tsx`, and `cart/CartPageClient.tsx` implement the responsive catalog cart page, including GSAP removal animation, background Sanity price refresh, unavailable-item blocking, sticky mobile checkout CTA, desktop summary sidebar, and recommended product grid.

`checkout/CheckoutForm.tsx`, `checkout/AddressSelector.tsx`, `checkout/PaymentMethodSelector.tsx`, and `checkout/OrderSummaryPanel.tsx` implement the protected checkout details screen with react-hook-form + Zod validation, Nigerian state selection, future-ready saved-address prefill, Flutterwave payment preference, and responsive form/summary layout.

`order/ProcessingScreen.tsx`, `order/PaymentFailedScreen.tsx`, and `order/OrderConfirmationScreen.tsx` implement the payment processing poller, failed payment retry screen, and confirmed order success screen.

`flash-sale/FlashSaleBanner.tsx` and `flash-sale/FlashSaleTimer.tsx` render the active sale banner and countdown. The dedicated `/flash-sale` page is still deferred to the Flash Sales spec.

Review submission components are still not built as of this writing. When building them:

- `OrderTracking` should render the four-stage progress tracker (Order Placed → Inprogress → Shipped → Delivered) matching the Figma desktop order detail screen, driven by `order_status_history` data.
- `SharedWishlistHeader` / `SharedWishlistItem` / `ClaimedBadge` / `IntentFlagBadge` / `ReminderOptIn` correspond directly to the giver-facing screens (shared wishlist view, item detail, purchase confirmation, claimed success).
- `FlashSaleTimer` needs to compute remaining time from a Sanity product's sale `endTime` and use `formatCountdown()` from `lib/utils.ts`.

## Conventions for new components

Place in the domain folder matching what the component represents, not where it's first used. Accept a `className` prop for layout-level overrides where reasonable. Prefer composing existing `ui/` primitives (`Button`, `Badge`, `PriceDisplay`) over rebuilding their styling inline. If a component needs `"use client"`, only mark the smallest possible component as client — don't make a whole page client just because one button needs interactivity.
