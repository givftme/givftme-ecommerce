## Application appearance

`app/globals.css` owns the light and dark semantic tokens and the Inter/Belleza
font variables. `app/layout.tsx` loads those fonts with `next/font/google` and
wraps routes in `next-themes`; the public `Navbar` exposes
`components/layout/ThemeSelector.tsx` for System, Light, and Dark preferences.
Use semantic utilities such as `bg-background`, `bg-card`, `text-foreground`,
`border-border`, and `bg-primary` for theme-aware surfaces and controls. Use
Inter for interface text and Belleza only for editorial display headings.

## Gift pricing

`components/admin/PricingControls.tsx` supplies `/admin/pricing` with four policy
forms, a reviewed sample before publication, explicit unset and error states,
and paginated publication history. It reuses `Input`, `Button`, and
`PriceDisplay`, existing brand tokens, and the admin candidate navigation.
`components/wishlist/GiftPriceEstimate.tsx` displays the safe linked estimate
or unavailable state on shared item pages and, with `compact`, shared wishlist
cards. Both respect wishlist price visibility.
Unknown delivery never appears as a zero charge or a complete payable total.

## Auth Flow Patterns

### Auth Screens

File: components/auth/AuthPageShell.tsx
Last updated: 2026-07-09

| Property         | Class                                            |
| ---------------- | ------------------------------------------------ |
| Background       | `bg-white`                                      |
| Border           | none                                             |
| Border radius    | none                                             |
| Text — primary   | `text-ink`, `text-2xl font-bold`                |
| Text — secondary | `text-muted`, `text-sm leading-5`               |
| Spacing          | `px-6 py-8`, `mb-7`, `space-y-1`                |
| Hover state      | `hover:bg-brand-light`                          |
| Shadow           | none                                             |
| Accent usage     | `text-brand` back arrow                         |

**Pattern notes:**
Recovery, welcome and verification screens use a `max-w-[430px]` content column, white background, brand red back action, and subtle GSAP entrance (`opacity` + `y: 20`). Login and signup use the shared account entry pattern below.

### Account Entry

File: components/auth/AuthForm.tsx, components/auth/AuthVisual.tsx
Last updated: 2026-09-22

| Property | Class |
| --- | --- |
| Background | visual `bg-peach`, form `bg-white`, inputs `bg-surface` |
| Border | inputs inherit `border-stone-200`, Google button `border-line` |
| Border radius | mobile form `rounded-t-3xl`, bubble `rounded-2xl`, buttons `rounded-full` |
| Primary text | heading `font-display text-3xl`, body `text-ink` |
| Secondary text | `text-sm leading-5 text-muted` |
| Spacing | form `space-y-4`, bubble `p-3`, mobile panel `px-6 py-6` |
| Hover state | links `hover:underline`, Google button `hover:bg-surface` |
| Shadow | visual bubble and mobile panel `shadow-soft` |
| Accent | `text-brand` links and icons, shared filled submit button |

**Pattern notes:**
One AuthForm handles login and signup, including existing validation and server actions. The shared AuthVisual uses the existing logo and waving mascot, with a compact mobile header and a desktop illustration panel. Use signup’s existing first name and last name fields. Input text remains at least 16px on mobile to avoid focus zoom. Session persistence controls and legal links need working backing behavior or destinations before inclusion.

### Account Type Selection

File: app/get-started/page.tsx, components/auth/AccountTypeOptions.tsx
Last updated: 2026-10-16

| Property | Class |
| --- | --- |
| Background | page `bg-background`, individual card `bg-card`, business card `bg-ink-deep` |
| Border | individual `border-line border-t-4 border-t-brand`, business `border-white/10` |
| Border radius | cards `rounded-2xl`, icon squares `rounded-2xl`, CTAs and badge `rounded-full` |
| Primary text | heading `font-display text-3xl sm:text-4xl`, card titles `text-xl font-semibold` |
| Secondary text | `text-sm leading-6 text-muted` (business `text-white/70`) |
| Spacing | cards `p-6 sm:p-7`, grid `max-w-[640px] gap-4 sm:grid-cols-2` |
| Hover state | individual `hover:border-brand` + red glow, business white glow; same on `focus-visible` |
| Shadow | `0 8px 32px rgba(197,4,4,0.12)` / `rgba(255,255,255,0.08)` on hover only |
| Accent | brand checkmarks, `ring-2 ring-brand` on the business card for `?hint=business` |

**Pattern notes:**
A standalone screen with no Navbar or Footer: logo and "The Gift Museum" tagline, then the two cards. Each card is a whole `Link` with the CTA drawn as a `buttonVariants` span, so it works without JavaScript. GSAP staggers the cards in and dips the clicked one to `scale: 0.97` before `router.push`; both skip under reduced motion. The business card uses `ink-deep` because `ink` flips to near-white in dark mode.

### Auth Form Controls

File: components/auth/AuthFormInput.tsx
Last updated: 2026-07-09

| Property         | Class                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Background       | `bg-white`                                                                                                                        |
| Border           | `border border-stone-200`                                                                                                         |
| Border radius    | `rounded-xl`                                                                                                                      |
| Text — primary   | `text-ink`, `text-xs font-medium` labels                                                                                          |
| Text — secondary | `placeholder:text-muted/60`, `text-brand` messages                                                                                |
| Spacing          | `h-12 px-4`, `space-y-2`, form `space-y-5`                                                                                         |
| Hover state      | password toggle `hover:text-ink`                                                                                                  |
| Shadow           | none                                                                                                                              |
| Accent usage     | `focus:border-brand focus:ring-2 focus:ring-brand/20`, password toggle icons, field errors in `text-brand`                        |

**Pattern notes:**
Auth fields use rounded-xl inputs, stone borders, and brand focus rings. Password fields keep the same input shell with a right-side lucide visibility toggle.

### OTP Entry

File: components/auth/OtpDisplay.tsx
Last updated: 2026-07-09

| Property         | Class                                                       |
| ---------------- | ----------------------------------------------------------- |
| Background       | empty `bg-white`, filled `bg-brand-light`                  |
| Border           | empty `border-stone-200`, filled `border-brand`            |
| Border radius    | `rounded-full`                                             |
| Text — primary   | `text-lg font-semibold text-brand`                         |
| Text — secondary | empty state `text-stone-300`                               |
| Spacing          | display `gap-2`, keys `gap-4`, key size `h-16 min-h-16`    |
| Hover state      | keypad `hover:bg-brand-light`                              |
| Shadow           | none                                                       |
| Accent usage     | brand red digits and light-red filled OTP boxes            |

**Pattern notes:**
OTP boxes and keypad keys are circular and large for touch. GSAP is reserved for digit entry, keypad press feedback, and error shake.

### Auth Prompt Sheet

File: components/auth/AuthPromptSheet.tsx
Last updated: 2026-07-09

| Property         | Class                                                                         |
| ---------------- | ----------------------------------------------------------------------------- |
| Background       | `bg-white`, overlay `bg-black/40`                                             |
| Border           | `border border-stone-100`                                                     |
| Border radius    | `rounded-t-2xl`                                                               |
| Text — primary   | `text-lg font-semibold text-ink`                                              |
| Text — secondary | `text-sm text-muted`                                                          |
| Spacing          | `p-6`, `space-y-3`, `mt-6`                                                    |
| Hover state      | filled `hover:bg-brand-dark`, outline `hover:bg-brand-light`, close `hover:text-ink` |
| Shadow           | `shadow-lg`                                                                   |
| Accent usage     | brand-filled Login CTA and brand-outline Create account CTA                   |

**Pattern notes:**
Protected-action prompts should use a bottom sheet on mobile and preserve the current path in `redirect` for both auth CTAs.

### Wishlists Screen

File: components/wishlist/WishlistItemList.tsx, components/wishlist/WishlistSidebar.tsx, components/wishlist/WishlistCoverPicker.tsx, components/wishlist/DeleteWishlistButton.tsx
Last updated: 2026-09-24

| Property         | Class                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Background       | page `bg-surface`, panels and sidebar cards `bg-white`, stats and visibility switch `bg-surface`, cover from `lib/wishlist/covers.ts` |
| Border           | current sidebar card `border-[1.5px] border-brand`, New wishlist `border-dashed border-brand/30`, outline controls `border-line` |
| Border radius    | cover `rounded-3xl sm:rounded-[30px]`, panels `rounded-[20px] sm:rounded-3xl`, sidebar cards `rounded-[18px]`, swatches `rounded-xl` |
| Text — primary   | sidebar heading and cover title `font-display`, stat values `font-display text-2xl`                    |
| Text — secondary | `text-sm text-muted`, sidebar subtitles and stat labels `text-xs text-muted`                           |
| Spacing          | grid `lg:grid-cols-[280px_minmax(0,1fr)]`, detail `gap-4`, panels `p-4 sm:p-5`, item list `gap-2.5`      |
| Hover state      | outline controls `hover:border-ink`, sidebar cards `lg:hover:translate-x-0.5`                          |
| Shadow           | Share and selected visibility `shadow-soft`, cover picker popover `shadow-float`                       |
| Accent usage     | brand Share button, ink selected add tab and Fetch button, cover gradients                             |

**Pattern notes:**
/wishlists redirects to the evergreen list; every list lives at /wishlists/[id] with the "My wishlists" sidebar (horizontal scroll below `lg`, sticky column from `lg`). The cover shows visibility, the Change cover palette, occasion or Evergreen pills and the title (occasion titles are renamed in occasion settings). The overview panel holds the inline visibility switch, Preview (/w/[id], owners can always open it), Share list, stats and, for occasion lists, settings and delete. Delete archives the occasion; the evergreen list has no delete. Add tabs keep the catalogue first; Paste a link opens AddItemSheet with the link already fetching. Covers are fixed palette keys stored in `wishlists.cover_color` (migration 029), never free colours.

### Wishlist Item Card

File: components/wishlist/WishlistItemCard.tsx
Last updated: 2026-09-24

| Property         | Class                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Background       | `bg-white`, thumbnail fallback `bg-surface text-brand`                                   |
| Border           | none on the card, icon buttons `border border-line`                                      |
| Border radius    | card `rounded-[20px] sm:rounded-[22px]`, thumbnail `rounded-2xl`, icon buttons `rounded-xl` |
| Text — primary   | title `text-sm sm:text-[15px] font-semibold text-ink`, price `font-semibold text-brand`  |
| Text — secondary | source line `text-xs text-muted`                                                         |
| Spacing          | card `p-3`, row `gap-3 sm:gap-3.5`, thumbnail `h-16 w-16 sm:h-19.5 sm:w-19.5`, actions wrap to a full row below `sm` |
| Hover state      | card `hover:shadow-soft`, icon buttons `hover:border-ink`, delete `hover:text-brand`     |
| Shadow           | hover only                                                                               |
| Accent usage     | source icon (store, link or manual), `Badge` success for gifted                           |

**Pattern notes:**
Rows stay compact for scanning and repeated edits. The source line shows the Givftme store, the link domain, or "Added by you" with a matching icon. Icon buttons are 40px touch targets: move up (only when `onMoveUp` is passed; saves immediately), edit and delete. The occasion detail page shares this card without move up.

### Wishlist Sheets

File: components/wishlist/AddItemSheet.tsx, components/wishlist/EditItemSheet.tsx
Last updated: 2026-07-10

| Property         | Class                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------- |
| Background       | sheet `bg-white`, info `bg-brand-light`, upload `bg-surface`, warning `bg-amber-50`    |
| Border           | upload `border border-dashed border-stone-200`                                         |
| Border radius    | fields/upload/previews `rounded-xl`, sheet inherited `rounded-t-2xl`                   |
| Text — primary   | labels `text-xs font-medium text-ink`, form copy `text-sm`                             |
| Text — secondary | helper text `text-muted`, errors `text-brand`                                          |
| Spacing          | form `mt-6 space-y-5`, upload `p-4`, preview image `h-28 w-28`                         |
| Hover state      | paste/manual controls `hover:bg-brand-light hover:text-brand`, links `hover:underline` |
| Shadow           | inherited sheet `shadow-lg`                                                            |
| Accent usage     | brand buttons, Naira prefix `text-muted`, amber currency disclaimer                    |

**Pattern notes:**
Wishlist sheets reuse auth form control language: rounded-xl inputs, stone borders, brand focus/error states, and restrained helper panels. External/user-uploaded images use raw previews so arbitrary URLs do not require Next image allowlists.

### Dashboard Toast

File: components/ui/Toast.tsx
Last updated: 2026-07-10

| Property         | Class                                                                            |
| ---------------- | -------------------------------------------------------------------------------- |
| Background       | default `bg-white`, danger `bg-red-50`, success `bg-green-50`                   |
| Border           | `border`, variants `border-stone-100`, `border-red-100`, `border-green-100`     |
| Border radius    | `rounded-2xl`, close button `rounded-full`                                      |
| Text — primary   | `text-sm font-semibold`, container `text-ink`                                   |
| Text — secondary | `text-xs leading-5 text-muted`                                                  |
| Spacing          | toast `p-4`, stack `space-y-3`, body `gap-3`                                    |
| Hover state      | close `hover:bg-white hover:text-ink`                                           |
| Shadow           | `shadow-lg`                                                                      |
| Accent usage     | semantic red/green only for feedback states                                     |

**Pattern notes:**
Toasts are compact feedback panels fixed above the mobile bottom nav and at bottom-right on desktop. Keep them informational, not decorative; use semantic color sparingly.

### Share Settings Sheet

File: components/wishlist/ShareSettingsSheet.tsx
Last updated: 2026-07-19

| Property         | Class                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------- |
| Background       | sheet `bg-white`, selected option `bg-brand-light`, setting rows `bg-surface`          |
| Border           | sheet/card `border border-stone-100`, selected option `border-brand`                   |
| Border radius    | sheet mobile `rounded-t-2xl`, desktop `rounded-2xl`, options `rounded-2xl`             |
| Text — primary   | `text-sm font-semibold text-ink`, sheet title inherited `text-lg font-semibold`        |
| Text — secondary | `text-xs text-muted`, helper/link text `text-sm text-muted`                            |
| Spacing          | sheet `p-6`, sections `space-y-7`, cards `p-4`, invite rows `p-3`                      |
| Hover state      | option `hover:bg-brand-light`, remove `hover:bg-red-50 hover:text-red-600`             |
| Shadow           | inherited sheet `shadow-lg`                                                           |
| Accent usage     | lucide icons `text-brand`, selected card `border-brand bg-brand-light`, brand CTAs     |

**Pattern notes:**
Share settings follows existing wishlist sheet density: compact sections, rounded-xl inputs, pill buttons, and restrained status rows. Friends-and-family links are invite-token-specific, so empty token states use muted helper copy instead of disabled-looking form controls.

### Shared Wishlist Cards

File: components/wishlist/SharedWishlistItem.tsx
Last updated: 2026-07-19

| Property         | Class                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------- |
| Background       | card `bg-white`, thumbnail fallback `bg-surface`, source badge `bg-surface`            |
| Border           | `border border-stone-100`                                                              |
| Border radius    | card `rounded-2xl`, thumbnail/status `rounded-xl`/`rounded-full`                       |
| Text — primary   | title `text-sm font-medium leading-5 text-ink`, price `text-sm font-semibold text-ink` |
| Text — secondary | source/status badge `text-xs font-medium text-muted`                                   |
| Spacing          | card `p-4`, row `gap-3`, metadata `mt-2 gap-2`                                         |
| Hover state      | title `hover:text-brand`, inactive filters elsewhere `hover:bg-brand-light`            |
| Shadow           | `shadow-sm`                                                                            |
| Accent usage     | available `bg-green-50 text-green-700`, claimed opacity, brand buy CTA                 |

**Pattern notes:**
Giver-facing item cards mirror dashboard wishlist cards but remove edit controls and prioritize the buy/claimed state. Price rendering must be omitted entirely when `prices_visible` is false.

### Shared Wishlist Header

File: components/wishlist/SharedWishlistHeader.tsx
Last updated: 2026-09-24

| Property         | Class                                                               |
| ---------------- | ------------------------------------------------------------------- |
| Background       | owner cover via `getWishlistCoverClass` (default brand gradient), avatar fallback `bg-brand-light`/`bg-surface` variants |
| Border           | none                                                                |
| Border radius    | desktop header `rounded-2xl`, avatar `rounded-full`                 |
| Text — primary   | `text-white`, name `text-xl font-bold`                              |
| Text — secondary | `text-white/70`, countdown `text-sm text-white`                     |
| Spacing          | mobile `px-4 pb-6 pt-8`, desktop `p-6`, content `gap-3`             |
| Hover state      | none                                                                |
| Shadow           | none                                                                |
| Accent usage     | full brand-red panel with white text                                |

**Pattern notes:**
The shared wishlist header is the first-viewport brand signal for giver pages. Keep it compact and informational, not hero-like; on desktop it becomes a sticky sidebar panel.

### Claimed Success

File: components/wishlist/GiftClaimedSuccess.tsx
Last updated: 2026-07-19

| Property         | Class                                                                         |
| ---------------- | ----------------------------------------------------------------------------- |
| Background       | page `bg-white`, icon circle `bg-brand-light`, reminder card `bg-white`       |
| Border           | reminder card `border border-stone-100`                                       |
| Border radius    | icon `rounded-full`, reminder card `rounded-2xl`                              |
| Text — primary   | headline `text-3xl font-bold text-ink`, reminder title `text-sm font-semibold` |
| Text — secondary | body `text-sm leading-6 text-muted`, reminder subcopy `text-xs leading-5`     |
| Spacing          | page `px-4 py-10`, stack `space-y-6`, reminder `p-4`                          |
| Hover state      | footer CTA uses ghost button `hover:bg-brand-light`                           |
| Shadow           | reminder `shadow-sm`                                                          |
| Accent usage     | success icon `text-brand`, primary opt-in CTA                                 |

**Pattern notes:**
Success screens should stay centered and calm, with a single large brand-light icon treatment and compact supporting cards underneath.

### Catalog Product Card

File: components/product/ProductCard.tsx
Last updated: 2026-07-20

| Property         | Class                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------- |
| Background       | image shell `bg-surface`, card body transparent                                       |
| Border           | none on card, image action buttons use implicit white surface                         |
| Border radius    | image `rounded-2xl`, icon buttons `rounded-full`                                      |
| Text — primary   | title `font-medium text-ink`, price via `PriceDisplay`                                |
| Text — secondary | subtitle `text-sm text-muted`, missing price `text-sm font-semibold text-muted`       |
| Spacing          | body `mt-3 space-y-1`, overlay `px-3 pb-3 pt-10`, action gap `gap-2`                  |
| Hover state      | title `hover:text-brand`, overlay `group-hover:opacity-100`, image controls visible   |
| Shadow           | wishlist icon `shadow-sm`                                                             |
| Accent usage     | sale `Badge`, `bg-ink` hover cart CTA, brand hover states                             |

**Pattern notes:**
Catalog cards keep product photography dominant and reserve cards/shadows for the interactive controls. Product titles clamp to two lines and missing prices render as muted text rather than fake currency.

### Product Detail Surface

File: components/product/ProductDetail.tsx
Last updated: 2026-07-20

| Property         | Class                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------- |
| Background       | page `bg-white`, info panels `bg-white`, helper panels `bg-surface`                  |
| Border           | panels `border border-stone-100`, tabs `border-b border-stone-100`                   |
| Border radius    | panels/images `rounded-2xl`, sale timer `rounded-xl`, controls `rounded-full`        |
| Text — primary   | title `text-3xl font-bold text-ink`, labels `text-sm font-semibold text-ink`         |
| Text — secondary | body/meta `text-sm text-muted`, description `text-sm leading-7 text-muted`           |
| Spacing          | page `px-4 py-10`, columns `gap-10`, right rail `space-y-6`, panel `p-4`/`p-5`       |
| Hover state      | text links `hover:text-brand`, button variants from `Button`                         |
| Shadow           | info/review cards `shadow-sm`                                                        |
| Accent usage     | brand CTAs, `bg-brand-light text-brand` timer/highlight, amber stars                 |

**Pattern notes:**
Product detail uses a two-column desktop layout and stacked mobile layout. Interactive catalog controls stay in compact bordered panels, while brand red is reserved for sale state and primary actions.

### Product Explorer

File: components/collection/ProductExplorer.tsx, components/collection/FilterSheet.tsx
Last updated: 2026-07-20

| Property         | Class                                                                               |
| ---------------- | ----------------------------------------------------------------------------------- |
| Background       | sidebar/card `bg-white`, checkbox rows `bg-surface`                                |
| Border           | `border border-stone-100`, inputs/selects `border-stone-200`                       |
| Border radius    | sidebar/cards `rounded-2xl`, filters `rounded-xl`, toolbar controls `rounded-full` |
| Text — primary   | headings `text-sm font-semibold text-ink`, toolbar value `text-sm font-medium`     |
| Text — secondary | result/filter copy `text-sm text-muted`, helper labels `text-xs font-medium`       |
| Spacing          | sidebar `p-5`, controls `space-y-6`, toolbar `gap-3`, list cards `p-4`             |
| Hover state      | view toggles active `bg-brand text-white`, links `hover:text-brand`                |
| Shadow           | sidebar/list cards `shadow-sm`                                                     |
| Accent usage     | brand active toggles, brand focus rings, brand filter CTA                          |

**Pattern notes:**
Catalog listing controls are utilitarian and compact. Mobile filters use the shared bottom sheet; desktop filters sit in a fixed-width left sidebar with the same input language.

### Museum Cards

File: components/occasion/MuseumOccasionCard.tsx, components/collection/CollectionCard.tsx
Last updated: 2026-07-20

| Property         | Class                                                                               |
| ---------------- | ----------------------------------------------------------------------------------- |
| Background       | card `bg-white`, image fallback `bg-surface`, emoji chip `bg-white`                |
| Border           | `border border-stone-100`, hover `hover:border-brand/40`                           |
| Border radius    | cards/images `rounded-2xl`, emoji chip `rounded-full`                              |
| Text — primary   | titles `text-base font-semibold text-ink`                                          |
| Text — secondary | descriptions/counts `text-sm text-muted`, collection description `leading-6`       |
| Spacing          | occasion card `p-4`, collection text `mt-4 space-y-2`, grids `gap-6`/`gap-8`       |
| Hover state      | image `group-hover:scale-105`, title/link `group-hover:text-brand`                 |
| Shadow           | occasion cards `shadow-sm`, emoji chip `shadow-sm`                                |
| Accent usage     | featured/sale `Badge`, brand text link                                             |

**Pattern notes:**
Museum cards are editorial but restrained: large real images when available, neutral fallbacks, and small brand accents. They should not become marketing hero cards.

### Newsletter Signup

File: components/shared/NewsletterSignup.tsx
Last updated: 2026-07-20

| Property         | Class                                                                               |
| ---------------- | ----------------------------------------------------------------------------------- |
| Background       | section `bg-surface`, panel `bg-white`, icon tile `bg-brand-light`                 |
| Border           | panel `border border-stone-100`                                                    |
| Border radius    | panel `rounded-2xl`, icon tile `rounded-full`, input inherited `rounded-xl`        |
| Text — primary   | heading `text-xl font-semibold text-ink`                                           |
| Text — secondary | supporting copy `text-sm leading-6 text-muted`, errors `text-xs text-brand`        |
| Spacing          | section `py-12`, panel `p-6`, content `gap-6`, form `gap-2`                        |
| Hover state      | button variants from `Button`                                                      |
| Shadow           | panel `shadow-sm`                                                                  |
| Accent usage     | brand icon tile, brand error text, success/danger toasts                           |

**Pattern notes:**
Newsletter capture is a compact CTA panel, not a marketing landing section. It keeps the same rounded input/button language as auth and wishlist sheets.

### Cart Item Card

File: components/cart/CartItem.tsx
Last updated: 2026-07-20

| Property         | Class                                                                             |
| ---------------- | --------------------------------------------------------------------------------- |
| Background       | `bg-white`, thumbnail `bg-surface`                                                |
| Border           | `border border-stone-100`                                                         |
| Border radius    | card `rounded-2xl`, thumbnail/alerts `rounded-xl`, action `rounded-full`          |
| Text — primary   | title `text-sm font-semibold text-ink`, totals via `PriceDisplay`                 |
| Text — secondary | variants/rating `text-xs text-muted`                                              |
| Spacing          | card `p-4`, row `gap-3`, controls `mt-4`                                          |
| Hover state      | remove `hover:bg-brand-light`                                                     |
| Shadow           | `shadow-sm`                                                                       |
| Accent usage     | remove icon `text-brand`, unavailable alert `bg-red-50 text-red-600`, amber stars |

**Pattern notes:**
Cart item cards mirror wishlist item density but replace edit/reorder controls with purchase controls. Keep image size fixed at 80px and use GSAP only for the removal animation.

### Checkout Form Surface

File: components/checkout/CheckoutForm.tsx
Last updated: 2026-07-20

| Property         | Class                                                                            |
| ---------------- | -------------------------------------------------------------------------------- |
| Background       | page `bg-surface`, panels `bg-white`, helper rows `bg-surface`                  |
| Border           | panels `border border-stone-100`, inputs `border-stone-200`                     |
| Border radius    | panels `rounded-2xl`, inputs/alerts `rounded-xl`                                |
| Text — primary   | page title `text-2xl font-bold text-ink`, labels `text-xs font-medium text-ink` |
| Text — secondary | helper text `text-xs/text-sm text-muted`                                         |
| Spacing          | page `px-4 py-8`, panels `p-5`, form `gap-4`/`space-y-4`                        |
| Hover state      | payment cards `hover:bg-brand-light`, buttons use shared variants               |
| Shadow           | panels `shadow-sm`                                                              |
| Accent usage     | brand focus rings, selected payment `border-brand bg-brand-light`, errors red   |

**Pattern notes:**
Checkout uses the auth/wishlist input language and a two-column desktop grid. Payment choice cards are compact operational controls, not decorative cards.

### Payment State Screens

File: components/order/ProcessingScreen.tsx, components/order/PaymentFailedScreen.tsx
Last updated: 2026-07-20

| Property         | Class                                                        |
| ---------------- | ------------------------------------------------------------ |
| Background       | `bg-white`                                                   |
| Border           | processing ring `border-4 border-brand-light border-t-brand` |
| Border radius    | ring `rounded-full`, alerts `rounded-xl`                     |
| Text — primary   | headline `text-2xl font-bold text-ink`                       |
| Text — secondary | body `text-sm leading-6 text-muted`                          |
| Spacing          | screen `min-h-dvh px-4`, stack `mt-6`/`mt-8`                 |
| Hover state      | support link `hover:text-brand`                              |
| Shadow           | none                                                         |
| Accent usage     | brand ring and failure icon                                  |

**Pattern notes:**
Payment state screens are full-screen, centered, and quiet. GSAP is reserved for the rotating ring and failed-icon entrance.

### Order Detail & Tracking

File: app/account/orders/[id]/page.tsx, components/order/OrderTracking.tsx, components/order/OrderStatusBadge.tsx, components/order/TrackingLink.tsx
Last updated: 2026-08-07

| Property         | Class                                                                         |
| ---------------- | ----------------------------------------------------------------------------- |
| Background       | page `bg-surface`, panels `bg-white`, thumbnails `bg-surface`                 |
| Border           | panels `border border-stone-100`, dividers `border-stone-100`, cancelled banner `border-red-100 bg-red-50` |
| Border radius    | panels `rounded-2xl`, thumbnails `rounded-xl`, tracker circles `rounded-full` |
| Text — primary   | headline `text-2xl md:text-3xl font-bold text-ink`, section title `text-lg font-semibold` |
| Text — secondary | body/item meta `text-sm/text-xs text-muted`                                   |
| Spacing          | page `py-10`, panels `p-5 md:p-6`, rows `py-4`                                |
| Hover state      | buttons use shared variants                                                   |
| Shadow           | panels `shadow-sm`                                                            |
| Accent usage     | tracker current-step pulse (GSAP), status badge color by status (`OrderStatusBadge`) |

**Pattern notes:**
Order detail replaces the former one-shot `OrderConfirmationScreen` (removed 2026-08-07 — see `16-ORDER-TRACKING.md`) with a persistent tracking view: a 4-step `OrderTracking` progress bar (or a red "Cancelled"/"Refunded" banner in place of it), order summary, shipping details, a conditional tracking section, and an expandable `<details>` status-history timeline. No separate confirmation screen exists anymore — `/account/orders/[id]` is the single destination for an order at every stage after payment resolves.

### Account shell and settings

File: components/account/AccountShell.tsx, components/account/SignOutButton.tsx, app/account/layout.tsx
Last updated: 2026-09-17

| Property | Class |
| --- | --- |
| Background | page `bg-surface`, navigation and content `bg-white` |
| Border | shared panel `border border-stone-100`, desktop sidebar divider `border-r border-stone-100` |
| Border radius | panels `rounded-2xl`, rows and supporting panels `rounded-xl` |
| Primary text | `text-ink`, headings `text-2xl font-bold`, row labels `text-sm font-semibold` |
| Secondary text | `text-sm leading-6 text-muted` |
| Spacing | panels `p-5`, navigation `space-y-2`, sections `mt-8` |
| Hover and focus | `hover:bg-surface`, `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand` |
| Shadow | none |
| Accent | active row `bg-brand-light text-brand`, shared text button for sign out |

**Pattern notes:**
One navigation component becomes the mobile Account hub and the desktop sidebar within a shared white panel. Nested mobile screens return through Back to Account; order details also link to All orders. Keep identity text wrappable, icons decorative, and active sections marked with `aria-current`. Account pages inherit the authenticated layout and must not add another PageWrapper. Sign out stays at the bottom of navigation with pending and retryable error states. Profile photo actions wrap on narrow screens and remain above a divided form section.

### Account Management

Files: `components/account/AccountShell.tsx`, `components/account/AccountAvatar.tsx`,
`components/account/DeleteAccountDialog.tsx`, `components/address/AddressBookClient.tsx`,
`components/address/AddressForm.tsx`, `components/order/OrderList.tsx`,
`components/order/OrderCard.tsx`

The account hub uses the shared shell for mobile navigation and the desktop
sidebar. Address editing uses one React Hook Form field group in both the
address sheet and checkout. Address and order cards use the existing white,
stone-border, rounded-2xl surface; keep the three order status tabs and their
counts visible without horizontal scrolling. GSAP entrances respect reduced
motion preferences.

The saved-address screen uses a one-column mobile grid and two columns on
desktop. Card actions live in a three-dot menu, deletion requires confirmation,
and removing the current default never selects a replacement. Checkout keeps
the saved-address selector above the editable shipping fields and includes the
save-for-next-time checkbox in that same panel.

### Gift checkout and purchase resume

File: components/checkout/GiftCheckoutForm.tsx, app/w/[id]/gift/[itemId]/checkout/page.tsx, app/gift/resume/page.tsx
Last updated: 2026-09-18

| Property | Class |
| --- | --- |
| Background | page `bg-surface`, panels `bg-white` |
| Border | panels `border border-stone-100` on the resume screens, none on gift checkout panels |
| Border radius | panels `rounded-2xl`, product thumbnail `rounded-xl` |
| Primary text | `text-ink`, page heading `text-2xl font-bold lg:text-3xl`, section headings `text-base font-semibold` |
| Secondary text | `text-sm leading-6 text-muted` |
| Spacing | panels `p-5`, resume panel `p-8` on desktop, form sections `space-y-6` |
| Shadow | panels `shadow-sm` |
| Accent | price `text-brand`, privacy and resume icons `text-brand`, warning banner `border-amber-200 bg-amber-50 text-amber-700` |

**Pattern notes:**
Gift checkout is one gift at quantity one, so it has no cart, no quantity control and no address fields. The buyer enters their own contact details only; where the gift is going is summarised in at most a first name, a city and a state beside a `ShieldCheck`, because the recipient's full address never reaches the browser. When the owner has set no destination, that panel says so plainly and payment still proceeds.

`/gift/resume` is a set of single message screens sharing one centred layout: an icon, a heading, one short paragraph and up to two stacked full width actions. There is one screen per way a resume can end (expired, taken, bought, account mismatch, missing reference), and every one of them offers a way back to the gift or the wishlist. Keep the copy free of blame and always state that nothing was charged.

### Gift Pooling

Files: `components/pools/PoolCreationDialog.tsx`, `components/pools/PoolPageClient.tsx`, `components/pools/PoolProgress.tsx`

Pool pages use a `bg-surface` canvas with white `rounded-2xl` panels, brand-red
progress, pill CTAs, and compact contributor rows. Creation and contribution
flows share the Dialog primitive with a mobile bottom-sheet position. Animate
the circular and horizontal progress with `useGSAP` and keep the reduced-motion
state immediate. The pool page is public to view; contributor details follow
the pool's visibility setting. Management controls appear only to the creator
and receiver, and the receiver alone edits the title.

The `/dashboard/pools` overview (`app/(dashboard)/dashboard/pools/page.tsx`) opens
with a `font-display` heading beside a decorative lucide gift-and-people
illustration, a full-width `h-14` brand pill to create a pool, a three-step
`bg-brand-light` explainer, a `bg-peach` share prompt and a closing
`bg-brand-light` "different gift" prompt. Active pool cards show the signed item
image, status badge, progress, a full-width ghost "View pool" action,
`PoolShareActions` (native share with clipboard fallback) and a `bg-green-50`
invite hint while the pool is open. Active pools preview three, with
`?view=all` showing the rest.

### Homepage Museum, Wishlist and Pool

File: app/_components/home/Museum.tsx, app/_components/home/Wishlist.tsx, app/_components/home/Pool.tsx
Last updated: 2026-09-22

| Property | Class |
| --- | --- |
| Background | Museum `bg-white`, Wishlist `bg-soft`, Pool `bg-ink` with white panels |
| Border | `border border-line` |
| Radius | cards `rounded-3xl` or `rounded-card-xl`, controls `rounded-full` |
| Primary text | headings `font-display text-4xl leading-tight`, panel headings `font-display text-3xl` or `text-2xl` |
| Secondary text | `text-sm text-muted`, dark section `text-white/80` |
| Spacing | sections `py-16`, panels `p-5` or `p-6`, content `gap-5` |
| Focus | `focus-visible:outline-2 focus-visible:outline-brand`, input group `focus-within:ring-2 focus-within:ring-brand` |
| Shadow | white preview panels `shadow-float` |

Homepage red accents use `brand`, `brand-light`, and `brand-dark` from `app/globals.css`. Shared `Btn`, `Pill`, and `Eyebrow` expose an explicit `brand` tone.

Museum uses the shared catalog grid for product actions. Wishlist and Pool previews carry explicit demo labels. Keep demo sharing distinct from saved wishlist sharing, keep actions visible on touch screens, and announce changing progress and validation errors.

### Business Page

File: app/business/page.tsx, app/business/_components/
Last updated: 2026-10-13

| Property | Class |
| --- | --- |
| Background | sections `bg-card` / `bg-soft`, always-dark panels `bg-ink-deep text-white`, planner `bg-brand-gradient`, studio stage peach radial (`peach` → `peach-deep`) |
| Border | `border-line`, selected controls `border-brand bg-brand-light` or filled `bg-primary` |
| Radius | panels `rounded-card-xl`, cards `rounded-card-lg`, controls `rounded-full` or `rounded-xl` |
| Primary text | hero `h1` in Inter with a `font-display italic` accent word (as on the home hero), section and card headings `font-display` with `clamp()` sizes, numeric readouts Inter `font-semibold tabular-nums` |
| Secondary text | `text-muted`, on dark panels `text-white/75` |
| Spacing | sections `py-24 max-sm:py-16`, panels `p-11`/`p-12` down to `px-4.5` on phones |
| Shadow | floating previews `shadow-float`, chips `shadow-soft` |

Account CTAs use `BusinessAccountCta` with the server-resolved viewer: a `line` variant under the hero buttons (an inline `text-brand` link, `min-h-11`) and a `buttons` variant in the HR dashboard section (`Btn` `brand` + `line`, full width below `sm`). Guests see Create a business account and Sign in, customers only Create, business members Open your dashboard, and an incomplete login (account type and membership disagree) a `line` "Check your business account" button and a "See how to fix it" sub-line, both to the auth screen. The Experience Centre stays the hero's primary CTA. On `/business` the Navbar adds a desktop "Sign in" link (`rounded-full px-4 hover:bg-surface`) beside Get started, and business accounts see an outlined Dashboard pill (`border-line`, `hover:border-brand`) on desktop and a "Business dashboard" drawer item on mobile.

Section CTAs use `BriefLink`, which scrolls to the Experience Centre and adds its occasion, note or team size to the brief through `BusinessContext`. The studio and the gift card preview share the visitor's brand name and colour; text on that colour picks light or dark ink at runtime (`color.ts`). The visitor's swatch colours are data, not theme tokens. The 3D studio follows `HeroStage`: `three` is imported on mount, the scene pauses off screen, and the controls keep working with a text fallback when WebGL is unavailable.

## Admin Dashboard

File: components/admin/AdminShell.tsx, components/admin/AdminUi.tsx, components/admin/AdminCharts.tsx
Last updated: 2026-10-15

| Property | Class |
| --- | --- |
| Background | page `bg-surface`, sidebar/top bar/panels `bg-card` |
| Border | `border border-line`; active nav `bg-brand-light text-brand` |
| Border radius | panels and stat tiles `rounded-2xl`, inputs/selects `rounded-xl`, buttons and tabs `rounded-full` |
| Primary text | page title `text-2xl font-bold md:text-3xl`, panel title `text-base font-semibold` |
| Secondary text | `text-xs text-muted`, table headers `text-xs uppercase tracking-wide text-muted` |
| Spacing | panels `p-5`, page `px-4 py-6 md:px-6 md:py-8`, grids `gap-3`/`gap-6` |
| Shadow | `shadow-card` |
| Accent | `text-brand` links, `text-danger` for drop-off and alerts (always with an icon or sign) |

**Pattern notes:**
One responsive shell: a collapsible sidebar from `lg`, a left drawer (`Sheet`) below it, and a sticky top bar with breadcrumb, people search for roles that can open People, and the member's name and role badge. Wide tables scroll inside `DataTable`; the page never scrolls sideways. Filters are plain GET forms so screens stay server-rendered. Charts are dependency-free, use the `--viz-*` tokens in fixed order, carry native tooltips, and always print their values as text.

## Business Dashboard

File: components/business-dashboard/BizDashShell.tsx, components/business-dashboard/BizDashSidebar.tsx, components/business-dashboard/BizUi.tsx
Last updated: 2026-10-15

| Property | Class |
| --- | --- |
| Background | page `bg-surface`, sidebar `bg-neutral-950 text-white` (dark in both themes), cards `bg-card`, Experience Centre card and auth panel `bg-ink text-background` |
| Border | cards `border border-border`, selected choices `border-brand bg-brand-light` |
| Border radius | cards `rounded-2xl`, inputs/selects `rounded-xl`, buttons, tabs and pills `rounded-full` |
| Primary text | view title `text-2xl font-bold md:text-3xl`, card title `text-base font-bold`, Inter throughout |
| Secondary text | `text-xs text-muted` / `text-sm text-muted` |
| Spacing | cards `p-5`, page `px-4 py-6 md:px-8 md:py-8`, grids `gap-3`/`gap-4 md:gap-6` |
| Shadow | none on cards; month cards `hover:shadow-card hover:-translate-y-0.5`; modals `shadow-float` |
| Accent | brand red for birthdays and primary actions, `text-purple` anniversaries, `text-green` campaigns, amber countdown chips at 7 days or fewer |

**Pattern notes:**
One client shell with no URL per view; the sidebar becomes a fixed 260px overlay at 1000px and below (`translateX(-102%)` → `0`, 0.3s), and two-column layouts stack there too. Stat and calendar grids go from four columns to two. `Modal` (Radix) enters with opacity and `scale(0.98)` over 0.25s via `starting:`; prefers-reduced-motion drops every transition in the shell to 0.01ms. `var(--company-brand)` (set on the shell from `business_accounts.brand_color`) only colours the company mark and the brand kit preview. Campaign status pills: Draft `muted`, Pending approval `warning`, Approved `info`, Delivered `success`; tiers: Standard `muted`, Premium `purple`, Signature `default`. Wide tables scroll inside their card. Overview's "Get set up" `Card` lists derived steps (people, logo, budget, first campaign) with `CheckCircle2 text-success` / `Circle text-muted` and a `text` button per open step the member may do; it disappears when nothing actionable is left. Below the sidebar nav, a "Givftme for Business site" link returns to `/business`. The auth screen shows a signed-in personal or incomplete login a `bg-surface` `rounded-2xl` notice with a this-device sign-out button (a `role="alert"` line if it fails); the incomplete one links to the Experience Centre. It offers "Resend confirmation link" (outline `sm`, with a `role="status"` result, then "Resend again in Ns" for 60s) on the check-email panel and after an unconfirmed sign-in, and after an expired link a bordered `rounded-2xl` "Need a new confirmation link?" box with an email field. Below both tabs, "Personal account? Sign in here" links to `/login`.
