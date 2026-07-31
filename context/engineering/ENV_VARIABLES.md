# Gifvtme — Environment Variables

Mirrors `.env.local.example` at the project root. Update both files together when a variable is added or removed.

## Supabase

| Variable | Public? | Description | Where to get it |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project API URL | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Anon/public key, respects RLS | Same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | **No — secret** | Bypasses RLS entirely | Same as above. Only used in `createServiceClient()` for system-triggered server actions. Never expose to client code or commit to version control. |

**If missing:** the app cannot connect to the database at all — nothing works.

## Sanity

| Variable | Public? | Description |
|---|---|---|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Yes | Sanity project identifier |
| `NEXT_PUBLIC_SANITY_DATASET` | Yes | Required dataset name; set explicitly, usually `production` for launch |

**If missing:** all catalog/museum pages fail to fetch product data — home page, shop, product detail pages will error or render empty.

## Resend

| Variable | Public? | Description |
|---|---|---|
| `RESEND_API_KEY` | **No — secret** | From resend.com dashboard |
| `RESEND_FROM_EMAIL` | No (server-only, not secret but not exposed) | Sender address for all transactional email |

**If missing:** wishlist invite creation still succeeds but logs that the invite email was not sent. Reminder emails (`/api/reminders`) fail the same way — each affected reminder's `retry_count` increments and it retries on the next cron run rather than sending, eventually hitting `permanently_failed` after 5 attempts. Order status emails and thank-you message emails still cannot send (not yet built).

**Resend dashboard dependency:** `RESEND_FROM_EMAIL` must belong to a verified sender/domain in Resend before invite delivery works in production.

## Microlink

| Variable | Public? | Description |
|---|---|---|
| `MICROLINK_API_KEY` | **No — secret** | From microlink.io. Optional at low volume (works without a key at reduced rate limits) but required for production reliability. |

**If missing:** `/api/scrape` still functions but at a much lower rate limit — fine for local dev, not for production.

## App

| Variable | Public? | Description |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Yes | Base URL used to build shareable wishlist links (`wishlistUrl()` in `lib/utils.ts`) and auth redirect URLs |

**If missing or wrong:** shared wishlist links and email confirmation/OAuth redirects will point to the wrong domain — this must be updated to the real production URL before launch (it defaults to `localhost:3000` in dev).

## Affiliate networks

| Variable | Public? | Description |
|---|---|---|
| `JUMIA_AFFILIATE_ID` | No | Used by `lib/affiliate/transform.ts` to build tracked redirect URLs |
| `AMAZON_AFFILIATE_ID` | No | Same |
| `KONGA_AFFILIATE_ID` | No | Same |

**If missing for a given network:** `transform.ts` falls back to a plain redirect with just a UTM source param, no commission tracking — the redirect still works, Gifvtme just earns nothing on that click. Add new retailer cases here as additional affiliate programs are joined.

## Flutterwave

| Variable | Public? | Description | Where to get it |
|---|---|---|---|
| `FLUTTERWAVE_SECRET_KEY` | **No — secret** | Server-side key used by `/api/checkout` and `/api/checkout/retry` to initiate hosted Flutterwave payments. | Flutterwave dashboard |
| `FLUTTERWAVE_SECRET_HASH` | **No — secret** | Custom webhook verification hash compared against Flutterwave's `verif-hash` header before any webhook body parsing or database writes. | Flutterwave dashboard → Webhooks |

**Flutterwave dashboard dependency:** configure the webhook URL as `[your-domain]/api/flutterwave/webhook`, set the same custom verification hash in Flutterwave and this env var, and make sure the account is configured for NGN payments.

## Cron secret

| Variable | Public? | Description |
|---|---|---|
| `CRON_SECRET` | **No — secret** | Shared bearer token for cron-protected routes such as `/api/occasions/archive` and `/api/reminders`. |

**If missing:** cron-protected routes return an error and refuse to run.

## General rule

Any variable without `NEXT_PUBLIC_` is server-only and must never be referenced from client component code — Next.js will silently fail to inline it (returning `undefined`) rather than erroring loudly, which can cause confusing bugs if attempted.
