# Feature: Metadata & Open Graph Images

## Overview
Two layers of metadata across the entire app. **Static metadata** covers fixed pages (home, shop, occasions, collections, product pages) with standard SEO title/description/canonical tags. **Dynamic metadata** covers shareable record pages — shared wishlists (`/w/[token]`) and gift pools (`/pool/[token]`) — where titles, descriptions, and Open Graph images are generated per record at request time using Next.js `ImageResponse` from `next/og`.

OG images are generated server-side as route handlers. No external image service needed. When a link is shared on WhatsApp, Twitter, iMessage, or any platform that reads OG tags, the preview shows a branded, content-specific image rather than a generic placeholder.

---

## Goals
- Every page has accurate, meaningful title and description meta tags for SEO.
- Shared wishlist and gift pool links produce rich, recognisable previews when pasted anywhere.
- OG images are generated dynamically per record — receiver name, occasion, item images, pool progress.
- No external image generation service — use Next.js built-in `next/og` `ImageResponse`.
- OG images are fast — generated at the edge, cached by Vercel's CDN after first render.

---

## User Stories
- As a receiver sharing my wishlist link, when my friend pastes it on WhatsApp they see my name, the occasion, and a grid of my gift items — not a blank preview.
- As a giver sharing a gift pool link, the preview shows the pool title, how much has been raised, and the item's product image (for item pools).
- As a product manager, every public page has a unique, descriptive title and meta description for search engine visibility.

---

## Functional Requirements

### Static metadata (all fixed pages)
1. Every page exports a Next.js `metadata` object or `generateMetadata` function.
2. Title format: `[Page Name] — Givftme` (e.g. "Birthday Gifts — Givftme", "The Gift Museum — Givftme").
3. Description: 120–155 characters, warm, second person where appropriate.
4. Canonical URL on all pages.
5. `og:type` = `website` for static pages.
6. Default OG image: a static branded image (`/og-default.png`) — 1200×630px, brand red background, Givftme logo and tagline. Used as fallback for any page without a dynamic OG image.

### Dynamic metadata — Shared wishlist (`/w/[token]`)
7. `generateMetadata` fetches the wishlist, receiver profile, and occasion from Supabase using the token.
8. Title: `[Receiver Name]'s [Occasion Name] Wishlist — Givftme` (e.g. "Amaka's Birthday Wishlist — Givftme"). If no occasion: `[Receiver Name]'s Wishlist — Givftme`.
9. Description: `Help [Receiver Name] celebrate their [occasion] — [item count] wishes, [X] still available.`
10. OG image: dynamically generated at `/api/og/wishlist/[token]` — see OG image spec below.
11. `og:type` = `website`. `twitter:card` = `summary_large_image`.
12. If wishlist is `private` or token is invalid: use the default OG image and a generic title — never expose the receiver's name for a private wishlist.

### Dynamic metadata — Gift pool (`/pool/[token]`)
13. `generateMetadata` fetches the pool record from Supabase using the token.
14. Title: `[Pool Title] — Gift Pool on Givftme` (e.g. "Help Tunde get his laptop — Gift Pool on Givftme").
15. Description (item pool): `[N] people have contributed ₦[amount_raised] of ₦[target_amount] towards [item name]. Join the pool!`
16. Description (general pool): `[N] people have contributed ₦[amount_raised] of ₦[target_amount] for [receiver name]. Join the pool!`
17. OG image: dynamically generated at `/api/og/pool/[token]` — see OG image spec below.
18. `og:type` = `website`. `twitter:card` = `summary_large_image`.

### Dynamic metadata — Product pages (`/product/[slug]`)
19. Title: `[Product Name] — Givftme`.
20. Description: first 155 characters of the product's Sanity description (plain text, strip Portable Text markup).
21. OG image: the product's primary image from Sanity (via `@sanity/image-url` builder at 1200×630). No generated overlay — the product photo is the OG image.
22. `og:type` = `product` (optional, helps Facebook/Pinterest product previews).

### Dynamic metadata — Occasion pages (`/occasions/[slug]`)
23. Title: `[Occasion Name] Gift Ideas — Givftme`.
24. Description: the occasion's Sanity description field.
25. OG image: the occasion's Sanity cover image at 1200×630.

---

## OG Image Specs

### Wishlist OG image — `/api/og/wishlist/[token]`

**Canvas:** 1200×630px

**Layout (Option C — avatar + name top, item grid below):**

```
┌─────────────────────────────────────────────────────────┐
│  [Brand red top bar — 8px]                              │
│                                                         │
│  [Avatar 80px circle]  [Receiver Name — bold, 36px]    │
│                        [Occasion name — 22px, muted]   │
│                        [Countdown — "In 14 days" chip] │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ Item img │  │ Item img │  │ Item img │  │  +N    │ │
│  │          │  │          │  │          │  │  more  │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
│                                                         │
│  [givftme.com logo — bottom right, small]              │
└─────────────────────────────────────────────────────────┘
```

**Design details:**
- Background: `#FFFFFF` white
- Top accent bar: 8px, `#C50404` brand red (full width)
- Avatar: circular, 80×80px. Fallback: initials on `#FEF2F2` background
- Receiver name: Inter Bold, 36px, `#000000`
- Occasion name: Inter Regular, 22px, `#4A4A4A`
- Countdown chip: small pill, `#FEF2F2` bg, `#C50404` text — e.g. "In 14 days"
- Item image grid: up to 3 images shown (180×180px each, `rounded-lg`). If ≥4 items: 4th slot shows "+N more" on a `#F7F7F7` background in `#4A4A4A` text
- If fewer than 1 item image available: show a single centred gift box illustration on brand-light background
- Givftme wordmark: bottom right, small (`givftme.com`), muted

**Data fetched:**
- Wishlist token → `wishlist_id`, `visibility`, `prices_visible`
- Receiver: `full_name`, `avatar_url`
- Occasion: `title`, `occasion_type`, `occasion_date`
- First 4 `wishlist_items` with `status='available'`: `image_url`, `title`

### Gift pool OG image — `/api/og/pool/[token]`

**Canvas:** 1200×630px

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  [Brand red top bar — 8px]                              │
│                                                         │
│  [Item image — 220×220px, rounded-xl, LEFT]            │
│                        [Pool title — bold, 32px]       │
│                        [Receiver name — 20px, muted]   │
│                                                         │
│                        [Progress bar — full width]     │
│                        [₦X raised of ₦Y — 24px]       │
│                        [[N] contributors — 18px]       │
│                                                         │
│  [givftme.com — bottom right]                          │
└─────────────────────────────────────────────────────────┘
```

**Design details:**
- Background: `#FFFFFF`
- Top accent bar: 8px brand red
- **Item pool:** left side shows the wishlist item's `image_url` (220×220px, `rounded-xl`, slight box shadow)
- **General pool:** left side shows a gift stack illustration on `#FEF2F2` background (same dimensions)
- Pool title: Inter Bold, 32px, `#000000`, max 2 lines (truncate with ellipsis)
- Receiver name: "For [Name]", Inter Regular, 20px, `#4A4A4A`
- Progress bar: full width of the right panel. Brand red fill. Percentage driven by `amount_raised / target_amount`. Rounded ends.
- Amount text: `₦[amount_raised] raised of ₦[target_amount]`, Inter Bold, 24px
- Contributor count: `[N] people contributed`, 18px, muted
- If `status='fully_funded'`: replace progress bar with a "🎉 Fully Funded!" banner in green

---

## Implementation

### File locations
```
app/
  layout.tsx                    — default metadata (title template, default OG)
  page.tsx                      — home page metadata
  occasions/[slug]/page.tsx     — occasion metadata
  collections/[slug]/page.tsx   — collection metadata
  product/[slug]/page.tsx       — product metadata
  shop/page.tsx                 — shop metadata
  flash-sale/page.tsx           — flash sale metadata
  w/[id]/page.tsx               — dynamic wishlist metadata
  pool/[token]/page.tsx         — dynamic pool metadata
  auth/*/page.tsx               — noIndex on all auth pages

api/
  og/
    wishlist/[token]/route.ts   — wishlist OG image generation
    pool/[token]/route.ts       — pool OG image generation
```

### Root layout metadata (default)
```typescript
// app/layout.tsx
import { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL!),
  title: {
    default: 'Givftme — The Gift Museum',
    template: '%s — Givftme',
  },
  description: 'Curate your wishlist, share it with loved ones, and never receive the wrong gift again. Browse the Givftme gift museum for every occasion.',
  openGraph: {
    siteName: 'Givftme',
    type: 'website',
    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'Givftme — The Gift Museum' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@givftme',
  },
}
```

### Static page metadata examples
```typescript
// app/shop/page.tsx
export const metadata: Metadata = {
  title: 'Shop All Gifts',
  description: 'Browse hundreds of curated gift ideas for every occasion, budget, and personality — all in one place.',
}

// app/flash-sale/page.tsx
export const metadata: Metadata = {
  title: '⚡ Flash Sale',
  description: 'Limited-time deals on handpicked gifts. These prices won\'t last — shop the Givftme flash sale before time runs out.',
}
```

### Dynamic wishlist metadata
```typescript
// app/w/[id]/page.tsx
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  // Resolve token
  const { data: invite } = await supabase
    .from('wishlist_invites')
    .select('wishlist_id, wishlists(title, visibility, user_id, occasion_id, occasions(title, occasion_type, occasion_date))')
    .eq('token', params.id)
    .single()

  let wishlist = invite?.wishlists
  if (!wishlist) {
    // Try as public share_token
    const { data } = await supabase
      .from('wishlists')
      .select('*, occasions(title, occasion_type, occasion_date)')
      .eq('share_token', params.id)
      .eq('visibility', 'public')
      .single()
    wishlist = data
  }

  // Private or not found — return generic metadata
  if (!wishlist || wishlist.visibility === 'private') {
    return {
      title: 'Wishlist',
      description: 'View this wishlist on Givftme.',
    }
  }

  // Fetch receiver name
  const { data: receiver } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', wishlist.user_id)
    .single()

  const occasion = wishlist.occasions
  const name = receiver?.full_name || 'Someone'
  const occasionTitle = occasion?.title || null

  const title = occasionTitle
    ? `${name}'s ${occasionTitle} Wishlist`
    : `${name}'s Wishlist`

  // Item count for description
  const { count: total } = await supabase
    .from('wishlist_items')
    .select('id', { count: 'exact', head: true })
    .eq('wishlist_id', wishlist.id)

  const { count: available } = await supabase
    .from('wishlist_items')
    .select('id', { count: 'exact', head: true })
    .eq('wishlist_id', wishlist.id)
    .eq('status', 'available')

  const description = occasionTitle
    ? `Help ${name} celebrate their ${occasionTitle} — ${total} wishes, ${available} still available. View their wishlist on Givftme.`
    : `${name} has ${total} gift wishes, ${available} still available. View their wishlist on Givftme.`

  const ogImageUrl = `/api/og/wishlist/${params.id}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}
```

### Dynamic pool metadata
```typescript
// app/pool/[token]/page.tsx
export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const { data: pool } = await supabase
    .from('group_gift_pools')
    .select(`
      title, target_amount, amount_raised, status,
      receiver:receiver_id(full_name),
      wishlist_items(title)
    `)
    .eq('token', params.token)
    .single()

  if (!pool) return { title: 'Gift Pool' }

  const receiverName = pool.receiver?.full_name || 'Someone'
  const itemName = pool.wishlist_items?.title
  const isItemPool = !!itemName
  const pct = Math.round((pool.amount_raised / pool.target_amount) * 100)

  const title = pool.title

  const description = isItemPool
    ? `Help get ${receiverName} "${itemName}" — ₦${pool.amount_raised.toLocaleString()} raised of ₦${pool.target_amount.toLocaleString()} (${pct}% funded). Join the pool on Givftme!`
    : `${pct}% funded — ₦${pool.amount_raised.toLocaleString()} raised of ₦${pool.target_amount.toLocaleString()} for ${receiverName}. Join the gift pool on Givftme!`

  const ogImageUrl = `/api/og/pool/${params.token}`

  return {
    title: `${title} — Gift Pool`,
    description,
    openGraph: {
      title: `${title} — Gift Pool on Givftme`,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} — Gift Pool on Givftme`,
      description,
      images: [ogImageUrl],
    },
  }
}
```

### Wishlist OG image route handler
```typescript
// app/api/og/wishlist/[token]/route.ts
import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { daysUntil, formatCountdown } from '@/lib/utils'

export const runtime = 'edge'

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const supabase = createClient()

  // Resolve token to wishlist
  // ... (same resolution logic as generateMetadata)
  // Fetch: receiver name, avatar_url, occasion title + date, first 4 available item images

  const interBold = await fetch(
    new URL('/fonts/Inter-Bold.ttf', req.url)
  ).then(r => r.arrayBuffer())

  const days = occasion?.occasion_date ? daysUntil(new Date(occasion.occasion_date)) : null
  const countdownLabel = days !== null
    ? days === 0 ? 'Today!' : days > 0 ? `In ${days} days` : 'Passed'
    : null

  return new ImageResponse(
    (
      <div style={{
        width: '1200px', height: '630px', display: 'flex', flexDirection: 'column',
        backgroundColor: '#ffffff', fontFamily: 'Inter',
      }}>
        {/* Top accent bar */}
        <div style={{ width: '100%', height: '8px', backgroundColor: '#C50404' }} />

        {/* Header row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '20px',
          padding: '40px 60px 32px',
        }}>
          {/* Avatar */}
          {avatarUrl ? (
            <img src={avatarUrl} width={80} height={80}
              style={{ borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              backgroundColor: '#FEF2F2', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: '32px', fontWeight: 700, color: '#C50404',
            }}>
              {receiverName.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Name + occasion */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '36px', fontWeight: 700, color: '#000000', lineHeight: 1.1 }}>
              {receiverName}&apos;s{occasionTitle ? ` ${occasionTitle}` : ''} Wishlist
            </span>
            {occasionTitle && (
              <span style={{ fontSize: '22px', color: '#4A4A4A' }}>{occasionTitle}</span>
            )}
          </div>

          {/* Countdown chip */}
          {countdownLabel && (
            <div style={{
              marginLeft: 'auto',
              backgroundColor: '#FEF2F2', color: '#C50404',
              padding: '6px 16px', borderRadius: '999px',
              fontSize: '18px', fontWeight: 600,
            }}>
              {countdownLabel}
            </div>
          )}
        </div>

        {/* Item image grid */}
        <div style={{
          display: 'flex', gap: '16px',
          padding: '0 60px', flex: 1, alignItems: 'center',
        }}>
          {itemImages.slice(0, 3).map((img, i) => (
            <img key={i} src={img} width={180} height={180}
              style={{ borderRadius: '12px', objectFit: 'cover' }} />
          ))}
          {extraCount > 0 && (
            <div style={{
              width: 180, height: 180, borderRadius: '12px',
              backgroundColor: '#F7F7F7', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: '28px', fontWeight: 700, color: '#4A4A4A',
            }}>
              +{extraCount}
            </div>
          )}
          {itemImages.length === 0 && (
            <div style={{
              flex: 1, height: 180, borderRadius: '12px',
              backgroundColor: '#FEF2F2', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: '64px',
            }}>
              🎁
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end',
          padding: '16px 60px 32px',
        }}>
          <span style={{ fontSize: '16px', color: '#4A4A4A' }}>givftme.com</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [{ name: 'Inter', data: interBold, weight: 700 }],
    }
  )
}
```

### Pool OG image route handler
```typescript
// app/api/og/pool/[token]/route.ts
import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET(req: Request, { params }: { params: { token: string } }) {
  // Fetch pool data: title, amount_raised, target_amount, receiver name,
  // wishlist_item image_url (if item pool), contributor count

  const pct = Math.min(Math.round((amountRaised / targetAmount) * 100), 100)
  const isFullyFunded = status === 'fully_funded'

  return new ImageResponse(
    (
      <div style={{
        width: '1200px', height: '630px', display: 'flex',
        flexDirection: 'column', backgroundColor: '#ffffff', fontFamily: 'Inter',
      }}>
        {/* Top accent bar */}
        <div style={{ width: '100%', height: '8px', backgroundColor: '#C50404' }} />

        {/* Main content row */}
        <div style={{
          display: 'flex', flex: 1, alignItems: 'center',
          padding: '40px 60px', gap: '48px',
        }}>
          {/* Left: item image or fallback */}
          {itemImageUrl ? (
            <img src={itemImageUrl} width={220} height={220}
              style={{ borderRadius: '16px', objectFit: 'cover',
                boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }} />
          ) : (
            <div style={{
              width: 220, height: 220, borderRadius: '16px',
              backgroundColor: '#FEF2F2', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '72px',
            }}>
              🎁
            </div>
          )}

          {/* Right: pool info */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '16px' }}>
            <span style={{ fontSize: '32px', fontWeight: 700, color: '#000000', lineHeight: 1.2 }}>
              {poolTitle}
            </span>
            <span style={{ fontSize: '20px', color: '#4A4A4A' }}>
              For {receiverName}
            </span>

            {/* Progress bar */}
            {isFullyFunded ? (
              <div style={{
                backgroundColor: '#DCFCE7', color: '#166534',
                padding: '10px 20px', borderRadius: '8px',
                fontSize: '22px', fontWeight: 700, textAlign: 'center',
              }}>
                🎉 Fully Funded!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{
                  width: '100%', height: '16px', backgroundColor: '#F7F7F7',
                  borderRadius: '999px', overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${pct}%`, height: '100%',
                    backgroundColor: '#C50404', borderRadius: '999px',
                  }} />
                </div>
                <span style={{ fontSize: '24px', fontWeight: 700, color: '#000000' }}>
                  ₦{amountRaised.toLocaleString()} raised of ₦{targetAmount.toLocaleString()}
                </span>
                <span style={{ fontSize: '18px', color: '#4A4A4A' }}>
                  {contributorCount} {contributorCount === 1 ? 'person has' : 'people have'} contributed
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end',
          padding: '0 60px 28px',
        }}>
          <span style={{ fontSize: '16px', color: '#4A4A4A' }}>givftme.com</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
```

---

## Database Changes
No new tables. Reads from existing tables only:
- `wishlists` — `title`, `visibility`, `user_id`, `occasion_id`, `share_token`
- `wishlist_invites` — `token` → `wishlist_id`
- `occasions` — `title`, `occasion_type`, `occasion_date`
- `users` — `full_name`, `avatar_url`
- `wishlist_items` — `image_url`, `title`, `status`
- `group_gift_pools` — `title`, `amount_raised`, `target_amount`, `status`, `token`, `receiver_id`
- `pool_contributions` — count of `status='paid'`

---

## Static assets needed

| File | Purpose | Dimensions |
|---|---|---|
| `/public/og-default.png` | Default OG image for all pages without dynamic OG | 1200×630px |
| `/public/fonts/Inter-Bold.ttf` | Font for OG image generation (edge runtime) | — |
| `/public/fonts/Inter-Regular.ttf` | Font for OG image generation | — |

**`og-default.png` design:** brand red (`#C50404`) background, centred Givftme wordmark in white, tagline "The Gift Museum" below in white at 60% opacity. Create once in Figma or any design tool and export as PNG.

**Font files:** must be present in `/public/fonts/` for the edge runtime OG image generators. Download Inter from Google Fonts, place the TTF files there. Do not load from Google Fonts CDN — the edge runtime cannot make external requests during image generation.

---

## API Endpoints

### `GET /api/og/wishlist/[token]`
Generates wishlist OG image.
**Auth:** none (public — called by social media crawlers).
**Runtime:** `edge`
**Cache:** `Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`
**Response:** PNG image (1200×630).

### `GET /api/og/pool/[token]`
Generates pool OG image.
**Auth:** none.
**Runtime:** `edge`
**Cache:** `Cache-Control: public, max-age=900, s-maxage=3600` (shorter cache — pool progress changes frequently)
**Response:** PNG image (1200×630).

---

## Permissions and Authorization
- All OG image routes are public — social media crawlers (WhatsApp, Twitter, Facebook) must be able to fetch them without auth.
- Private wishlist: return the default brand OG image — never generate a personalised OG for a private wishlist (don't expose the receiver's name or items to crawlers).
- If pool token not found: return the default brand OG image.

---

## Validation
- Token format: UUID. If not a valid UUID format, return 400 and the default OG image.
- Avatar URLs: must be a full URL starting with `https://`. If not, skip and render initials fallback — never pass a relative path to `<img>` in the edge runtime.
- Item images: same — full https:// URLs only. Skip items with relative or missing image URLs.
- Pool progress percentage: clamp to 0–100 (never render a progress bar > 100% even if data is incorrect).

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Token not found in DB | Return default brand OG image (200, not 404 — crawlers don't retry 404s the same way) |
| Private wishlist | Return default brand OG image |
| DB fetch fails | Return default brand OG image |
| Avatar image URL broken (fetch fails in edge) | Render initials fallback |
| Item image URL broken | Skip that item, show remaining items or fallback gift icon |
| Font file missing | `ImageResponse` will fail — log and return default OG image |

---

## Caching Strategy

| Route | `max-age` | `s-maxage` | Notes |
|---|---|---|---|
| `/api/og/wishlist/[token]` | 3600 (1hr) | 86400 (24hr) | Wishlist items change infrequently |
| `/api/og/pool/[token]` | 900 (15min) | 3600 (1hr) | Pool progress changes often — shorter cache |

Vercel's CDN respects `s-maxage` — the image is generated once and cached at the edge. Subsequent requests for the same token are served from cache. Cache is invalidated when `max-age` expires or on the next deploy.

---

## Complete Static Metadata Reference

| Page | Title | Description |
|---|---|---|
| `/` | The Gift Museum | Discover curated gift ideas for every occasion. Create your wishlist, share it with loved ones, and make gifting joyful for everyone. |
| `/shop` | Shop All Gifts | Browse hundreds of curated gift ideas for every occasion, budget, and personality. |
| `/occasions` | Gift Ideas by Occasion | From birthdays to weddings — browse gift ideas curated for every special moment. |
| `/occasions/[slug]` | [Occasion] Gift Ideas | [Occasion Sanity description] |
| `/collections/[slug]` | [Collection] — [Occasion] | [Collection Sanity description] |
| `/product/[slug]` | [Product Name] | [First 155 chars of product description] |
| `/flash-sale` | ⚡ Flash Sale | Limited-time deals on handpicked gifts. These prices won't last — shop before time runs out. |
| `/search` | Search Results | Find the perfect gift on Givftme. |
| `/cart` | Your Cart | noIndex |
| `/checkout` | Checkout | noIndex |
| `/dashboard/*` | Dashboard | noIndex |
| `/account/*` | My Account | noIndex |
| `/auth/*` | — | noIndex |
| `/w/[token]` | [Dynamic] | [Dynamic — see above] |
| `/pool/[token]` | [Dynamic] | [Dynamic — see above] |

Pages marked `noIndex` should include `robots: { index: false }` in their metadata.

---

## Loading and Empty States
OG image routes have no loading states — they are synchronous edge functions. If the DB query takes too long (>5 seconds), the edge function times out and Vercel returns a 504. The social media crawler will fall back to the default OG image from the page's `og:image` tag. This is acceptable — the default brand image is a reasonable fallback.

---

## Edge Cases

1. **Receiver name contains special characters** (e.g. apostrophe: "Chidi's"). In JSX within `ImageResponse`, use `&apos;` or template literals carefully — raw apostrophes in JSX attributes can cause issues. Escape receiver names before rendering in the OG image.

2. **Wishlist has no item images** (all items were added manually with no image, or images are all null). Show the single gift box emoji centred on a `#FEF2F2` background — the fallback is designed into the layout.

3. **Pool progress is exactly 100%** when the OG image is requested (but status is still `open` due to a race). Clamp the progress bar to 100% and show "Fully Funded!" state regardless.

4. **Very long pool title** (e.g. 80 characters). `ImageResponse` JSX doesn't auto-truncate — apply `overflow: 'hidden'`, `textOverflow: 'ellipsis'`, `maxWidth` constraints, and `whiteSpace: 'nowrap'` OR limit to 2 lines with `display: '-webkit-box'`, `WebkitLineClamp: 2`.

5. **WhatsApp caches OG images aggressively.** WhatsApp fetches the OG image once and caches it for days. If a pool reaches its target, the cached OG image will still show the old progress bar to users who already fetched it. This is acceptable — the pool page itself always shows live data. For critical updates, a `?v=[timestamp]` cache-bust param can be appended to the OG image URL in the metadata, but this defeats CDN caching. Leave as-is for v1.

6. **Twitter/X doubles the OG image URL** in some cases if both `og:image` and `twitter:image` are set to the same generated URL. Always set both — Twitter prefers `twitter:image` and other platforms prefer `og:image`.

7. **Occasion date in the past** (archived occasion but wishlist link still shared). The countdown chip should show "Passed" rather than a negative number — handle in the OG image generator: `days < 0 ? 'Passed' : days === 0 ? 'Today!' : \`In ${days} days\``.

---

## Analytics / Events
- `og.wishlist_image.generated` (token, has_avatar, item_count)
- `og.pool_image.generated` (token, pool_type: item | general, is_fully_funded)
- `og.image.fallback_used` (route, reason: not_found | private | db_error | font_missing)

---

## Testing Requirements

### Unit tests
- `generateMetadata` for wishlist: private → generic metadata; public with occasion → correct title format.
- `generateMetadata` for pool: item pool → item name in description; general pool → receiver name in description.
- Countdown label logic: positive days, zero, negative, null.
- Progress bar percentage clamping: 0, 50, 100, 105 (should clamp to 100).

### Integration tests
- `GET /api/og/wishlist/[token]` with valid public token → 200, returns `image/png` content-type.
- `GET /api/og/wishlist/[token]` with private wishlist token → 200, returns default brand image.
- `GET /api/og/wishlist/[invalid]` → 200, returns default brand image.
- `GET /api/og/pool/[token]` with valid item pool token → 200, returns image with pool data.
- `GET /api/og/pool/[token]` with fully_funded pool → 200, returns image with "Fully Funded" state.

### Manual QA
- Share a public wishlist link on WhatsApp — verify the preview shows the receiver's name, occasion, and item images.
- Share a gift pool link on WhatsApp — verify progress bar, amount raised, and item image show correctly.
- Share a private wishlist link — verify the generic Givftme brand image shows, not the receiver's personal data.
- Check Twitter card validator (cards-dev.twitter.com) for a pool link — verify correct image and metadata.
- Check Facebook Sharing Debugger for a wishlist link — verify OG tags parse correctly.

---

## Acceptance Criteria
- [ ] Every public page has a `<title>` and `<meta name="description">` tag.
- [ ] Auth, dashboard, account, cart, and checkout pages have `robots: noIndex`.
- [ ] Root layout defines a default title template and default OG image.
- [ ] Shared wishlist link produces a dynamic title with receiver name and occasion.
- [ ] Wishlist OG image shows avatar + name + occasion + up to 3 item images + gift icon fallback.
- [ ] Private wishlist metadata is generic — never exposes the receiver's name.
- [ ] Gift pool link produces a dynamic title with pool title and progress.
- [ ] Pool OG image shows item image (item pool) or gift icon (general pool) + progress bar + amounts.
- [ ] Fully funded pool OG image shows the "Fully Funded" state instead of a progress bar.
- [ ] Both OG image routes run on the edge runtime with correct cache headers.
- [ ] Inter font TTF files are present in `/public/fonts/` for edge image generation.
- [ ] Default brand OG image (`/public/og-default.png`) exists at 1200×630px.

---

## Future Improvements
- Animated OG images (GIF or video previews) — currently not supported by most platforms.
- OG image cache invalidation on wishlist update (Vercel On-Demand ISR for OG routes).
- Per-collection OG images using the collection's editorial photography.
- Structured data (`application/ld+json`) for product pages (Google rich results for gift products).
- `og:type = 'product'` full implementation for Facebook/Pinterest product cards.
