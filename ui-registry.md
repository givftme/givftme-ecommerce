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
Auth screens are full-screen mobile-first surfaces with a `max-w-[430px]` content column, white background, brand-red back action, and subtle GSAP entrance (`opacity` + `y: 20`).

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

### Dashboard Wishlist Card

File: components/wishlist/WishlistCard.tsx
Last updated: 2026-07-10

| Property         | Class                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| Background       | `bg-white`, prompt `bg-surface`, icon tile `bg-brand-light`           |
| Border           | `border border-stone-100`                                             |
| Border radius    | `rounded-2xl`, prompt `rounded-xl`                                    |
| Text — primary   | `text-ink`, title `text-2xl font-bold`                                |
| Text — secondary | `text-sm text-muted`                                                  |
| Spacing          | `p-5`, `gap-4`, actions `grid grid-cols-2 gap-3`, prompt `px-4 py-3`  |
| Hover state      | filled/ghost button variants, icon/text actions `hover:text-brand`    |
| Shadow           | `shadow-sm`                                                           |
| Accent usage     | `Badge` evergreen chip, `bg-brand-light text-brand` gift icon tile    |

**Pattern notes:**
Dashboard cards use white surfaces over the dashboard `bg-surface`, soft stone borders, 16px card radius, and compact action rows. Future dashboard cards should match this density rather than adopting marketing-style hero spacing.

### Wishlist Item Card

File: components/wishlist/WishlistItemCard.tsx
Last updated: 2026-07-10

| Property         | Class                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------- |
| Background       | `bg-white`, thumbnail fallback `bg-surface`                                            |
| Border           | `border border-stone-100`                                                              |
| Border radius    | card `rounded-2xl`, thumbnail `rounded-xl`, icon buttons `rounded-full`                |
| Text — primary   | title `text-sm font-medium leading-5 text-ink`, price `text-sm font-semibold text-ink` |
| Text — secondary | metadata `text-xs text-muted`                                                          |
| Spacing          | card `p-4`, row `gap-3`, metadata `mt-2 gap-2`                                         |
| Hover state      | edit/reorder `hover:bg-brand-light hover:text-brand`, delete `hover:bg-red-50`         |
| Shadow           | `shadow-sm`                                                                            |
| Accent usage     | store/status `Badge`, muted purchased state `opacity-50`                               |

**Pattern notes:**
Wishlist rows are compact operational cards, optimized for scanning and repeated edits. Keep thumbnails square and small, use muted metadata, and reserve stronger color for actions/status only.

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
