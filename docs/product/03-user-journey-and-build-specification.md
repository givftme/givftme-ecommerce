User Journey & Build Specification

GIVTME · DOCUMENT 3 OF 3

Prepared by: BendingWaters Technology Limited

Prepared for: Givtme — Founder & Leadership

Audience: Engineering

Date: September 2026

## 1. Where the build currently stands


The live site is a working conventional gift store: product catalogue via Sanity, occasion categories, cart, checkout, account, and wishlist/dates pages present in navigation.

What isn't there yet is the platform layer — the four things that make this Givtme rather than a small Jumia:

Everything in the twelve-week plan below serves those four.

## 2. Personas


The contributor is the most important persona to get right and the easiest to overbuild for. They arrive from a WhatsApp link, on mobile, probably on poor data, with low intent. Any friction — forced signup, OTP, long forms — kills the conversion and the referral with it. Guest flow is not optional.

## 3. Data model


User

id, name, phone, email, auth_provider, avatar_url

locale, currency (NGN | USD | GBP), timezone

notification_prefs { channel[], quiet_hours, frequency_cap }

is_diaspora (bool), created_at

Contact // a person the user gives to

id, owner_user_id

name, relationship (enum), phone?, email?, avatar_url?

linked_user_id? // set if this contact joins Givtme

notes, interests[] // feeds recommendations

created_at

Occasion

id, contact_id, owner_user_id

type (enum: birthday | wedding | anniversary | naming_ceremony |

omugwo | graduation | new_job | promotion | housewarming |

japa_sendoff | sallah | christmas | valentines | mothers_day |

fathers_day | childrens_day | condolence | custom)

date, recurs_annually (bool)

is_milestone (bool) // 30th, 60th, 10th anniversary etc.

reminder_config, created_at

Wishlist

id, owner_user_id

title, occasion_id?

slug // public URL: /w/{slug}

visibility (public | link_only | private)

cover_image, message // owner's note to visitors

delivery_address_id? // optional, revealed only on purchase

view_count, share_count, created_at

WishlistItem

id, wishlist_id

source (catalog | external_link | manual)

product_id? // internal catalogue

external_url?, external_domain?

title, image_url, price_ngn, price_source_currency

priority (must_have | would_love | nice_to_have)

quantity_wanted, quantity_claimed

claim_visible_to_owner (bool) // default false — protect the surprise

created_at

Claim

id, wishlist_item_id

claimed_by_user_id?, claimed_by_guest_token?

status (reserved | purchased | released)

expires_at // auto-release reserved claims after 72h

created_at

Pool

id, created_by_user_id

target_item_id?, target_amount_ngn

occasion_id?, recipient_contact_id

slug // public URL: /p/{slug}

deadline, status (open | funded | closed | refunded)

provider_reference // escrow/PSP reference — see §7

created_at

Contribution

id, pool_id

contributor_user_id?, contributor_guest_name?

amount_ngn, is_anonymous (bool), message

payment_reference, status (pending | confirmed | refunded)

created_at

Order

id, buyer_user_id?, guest_token?

source (direct | wishlist | pool | reminder | corporate)

wishlist_item_id?, pool_id?, occasion_id?

items[], subtotal, delivery_fee, service_fee, total

delivery_window_start, delivery_window_end // NOT just a date

gift_message, is_surprise (bool)

recipient_name, recipient_phone, recipient_address

status, delivery_photo_url, delivered_at

created_at

ReferralEvent // instrument the loop from day one

id, source_type (wishlist | pool | order | wrapped)

source_id, referrer_user_id

visitor_token, action (view | claim | contribute | signup | order)

created_at

Two design decisions worth flagging to the team:

Contact is deliberately separate from User. Most people you give to will never sign up. When they do, linked_user_id connects them and their wishlist becomes visible to everyone who saved their date — that's a strong moment and it needs the model to support it from the start.

delivery_window_start/end rather than a delivery date. Gifting is deadline-critical in a way ordinary e-commerce is not. The whole fulfilment system should be built around windows, not days.

## 4. The journeys


### 4.1 Giver — first-time, arriving cold


Landing

→ "Who are you giving to?" (relationship picker, no signup yet)

→ "When?" (date or occasion picker)

→ Show 6 gift suggestions immediately ← value before signup

→ Select gift

→ Signup prompt: "Save this and we'll remind you next year"

→ Auth (phone OTP or Google)

→ Delivery details + gift message

→ Payment

→ Confirmation + "Add two more dates while you're here"

Rule: no auth wall before the user has seen a suggestion. The current site sends people to /login too early.

### 4.2 Giver — saving dates


Dates

→ Add contact (manual, or contact import with explicit consent)

→ Name + relationship + date [three fields, nothing more]

→ Immediately: "Here's what people give to [relationship] for [occasion]"

→ Optional: add interests to sharpen suggestions

→ Repeat / bulk add

Contact import needs explicit, specific consent and a clear statement of what is stored. Nigerian users are increasingly alert to this, and NDPR obligations apply. Store only what you use.

### 4.3 The reminder ladder


Three per occasion, hard cap.

Implementation: scheduled job scanning occasions daily against each user's timezone and quiet hours. Idempotent — never double-send. Every notification carries a deep link to a pre-filled action, never to a generic homepage.

WhatsApp requires an approved Business API template per message type. Start that approval process early; it takes longer than teams expect and it sits on the critical path for the retention mechanic.

### 4.4 Receiver — creating a wishlist


Create wishlist

→ Title + occasion + cover

→ Add items:

· browse catalogue

· paste external link ← see §5

· manual entry (name, price, photo)

→ Set priority per item

→ Set visibility

→ Add a personal message

→ Get share link + auto-generated share card

→ Share: WhatsApp / Instagram story / X / copy link

The share card is generated server-side as an image sized for WhatsApp status and Instagram story. This is a growth feature, not a nice-to-have — make it genuinely attractive.

### 4.5 Visitor — the public wishlist (the most important page)


/w/{slug} [NO AUTH REQUIRED]

→ Owner's name, photo, occasion, countdown

→ Owner's message

→ Items, priority-ordered, claimed ones greyed

→ Per item: "Get this" | "Contribute toward it"

→ Guest checkout, full flow, no account

→ Post-purchase: "Want a reminder next year?" → soft signup

→ Persistent footer: "Make your own wishlist"

Requirements: loads under 3 seconds on 3G, works fully without JavaScript-heavy interaction, SSR for link previews, correct Open Graph tags so the WhatsApp preview looks good. Claims are hidden from the owner by default — the surprise is the product.

### 4.6 Contributor — pooling


/p/{slug} [NO AUTH REQUIRED]

→ Recipient, gift, target, progress bar, deadline

→ Contributor wall (names + amounts, anonymous option)

→ "Contribute": amount (no minimum) + optional message

→ Pay (card / transfer / USSD)

→ Confirmation + share prompt

→ On target reached: all contributors notified together

→ On deadline missed: organiser chooses top-up, downgrade, or refund

The refund path must be built before launch, not after. Pools will fail and the failure has to be handled cleanly or it becomes a trust problem.

### 4.7 Fulfilment and the reveal


Order confirmed

→ Vendor/warehouse assignment

→ Packing (gift wrap + printed note)

→ Delivery scheduled INTO the window

→ Courier captures delivery photo

→ Giver notified: photo + confirmation

→ Receiver gets light thank-you prompt

→ Both prompted to save the date for next year

The delivery photo is a hard requirement, not an enhancement — it's the highest-value moment in the product, especially for diaspora orders. Build photo capture into the courier handoff from day one.

## 5. External link unfurling — read this before building it


The "paste any link" promise is central to the pitch and will partially fail in practice. Plan for that honestly rather than discovering it in week ten.

Build it as a graceful cascade:

Server-side fetch with a short timeout → parse Open Graph / Twitter Card / JSON-LD

On failure, try oEmbed if available

On failure, fall back immediately to manual entry — pre-fill the domain, ask for title, price and a photo upload

Cache results by URL hash (24h) so popular items resolve instantly

Never block the UI on the fetch — show an optimistic card and fill it in

The fallback must feel like a normal path, not an error. Copy: "We couldn't pull the details — add them yourself, takes ten seconds." Never "Failed to fetch URL."

Run all fetches through a queue with rate limiting and a rotating user agent, and respect robots.txt. Getting the platform IP blocked by Jumia would be a self-inflicted wound.

## 6. Instrumentation — build this in week one


The business case rests on roughly 40% of new users arriving organically. That number has to be measurable from the first day, not reconstructed later.

Track, at minimum:

Wishlists created → shares per wishlist → views per share → actions per view → signups per action

Pools created → contributors per pool → new users per pool

Reminders sent → opened → clicked → converted, split by channel

Dates saved per user (the leading indicator of retention)

Repeat order rate by cohort

Delivery-window hit rate (the single most important operational metric)

One dashboard, reviewed weekly. If organic share sits below 20% by month four, that's a signal to stop scaling spend and fix the loop.

## 7. Pooled funds — architecture constraint


Contributions must never sit in a Givtme-controlled bank account.

Use a licensed provider's escrow or split-payment product (Paystack, Flutterwave, or a licensed escrow service). Givtme holds a reference and an instruction; the provider holds the money. Refunds run through the same provider.

This is a regulatory constraint, not a preference. Get legal advice on the structure before the first naira moves — this document isn't legal advice and shouldn't be treated as it.

## 8. Twelve-week build plan


Not in the first twelve weeks: corporate dashboard, diaspora multi-currency, mascot animations, Wrapped, ads platform, mobile apps. All are in the roadmap; none should delay the loop.

## 9. Acceptance criteria — the ones that actually matter


A reminder fires on schedule, in the user's timezone, respecting quiet hours, never twice

A public wishlist loads in under 3 seconds on throttled 3G on a mid-range Android device

A guest can buy from a wishlist, start to finish, without creating an account

A guest can contribute to a pool in under 60 seconds from cold link-open

A failed link unfurl drops into manual entry with no visible error state

A claimed item is hidden from the wishlist owner

A pool that misses its deadline refunds every contributor automatically within 48 hours

A delivery photo is captured on every completed order

Every referral touchpoint writes a ReferralEvent

Condolence occasions render with no mascot, no confetti, no streak language

## 10. Technical notes for the team


Mobile-first, Android-first. Test on a mid-range device on poor signal before anything ships.

SSR the public pages (/w/, /p/) — link previews and load speed both depend on it.

Idempotency keys on all payment and notification writes. Double-charging a contributor or double-sending a reminder both cost trust disproportionately.

Timezone handling matters here more than usual — diaspora givers and Lagos recipients are in different zones and the date is the entire point.

NDPR compliance on contact data. Explicit consent for imports, clear retention policy, working deletion.

Rate-limit the unfurl service and queue it — it's the most abuse-prone surface in the system.

Read alongside the business case (why) and the experience design (what it should feel like). Where this document and the experience design document appear to conflict, the experience design wins — the technical approach should bend to the feeling, not the other way round.


## Tables

| Missing capability | Why it's the priority |
| --- | --- |
| Reminder engine that actually fires | Dates can be saved but nothing happens. This is the retention mechanic. |
| Public shareable wishlists | Wishlists exist but aren't shareable to non-users. This is the entire growth loop. |
| External link unfurling | "Paste a Jumia/Amazon link" is core to the pitch and not built. |
| Gift pooling | Group contribution toward one item. Raises order value and pulls in 5–15 users per pool. |


|  | The Giver | The Receiver | The Contributor | The Corporate Buyer |
| --- | --- | --- | --- | --- |
| Wants | To not forget, and to not get it wrong | To get something they'll use, without asking | To join in without friction or awkwardness | To run employee occasions on autopilot |
| Enters via | Ad, referral, or a friend's wishlist | Invitation to create a list | A pool link in a group chat | Sales conversation |
| Success | Gift lands on the day, recipient reacts | List gets used, gifts arrive | Contributed in under 60 seconds | Zero missed birthdays, one invoice |
| Frequency | 3–8 times/year | 1–3 times/year | 2–10 times/year | Monthly |
| Account required? | Yes, eventually | Yes | No — guest checkout mandatory | Yes, with team seats |


| Trigger | Channel priority | Content |
| --- | --- | --- |
| T-30 days (milestones only) | WhatsApp → email | Planning prompt, no hard sell |
| T-7 days | WhatsApp → push → email | Three specific suggestions. Their wishlist first if one exists. |
| T-1 day | WhatsApp → push → SMS | Same-day options only. One tap to buy. |
| T+1 day (only if no action) | Push | Recovery: "Late is survivable." Once only. |


| Source | Reality |
| --- | --- |
| Jumia | Open Graph tags generally readable. Affiliate programme exists — tag links. |
| Konga | Usually readable. |
| Amazon | Aggressively blocks scrapers. Expect frequent failure. Product Advertising API needs an approved affiliate account. |
| Temu / Shein | Heavy bot protection. Assume failure. |
| Instagram vendor posts | Very common in Nigeria and mostly unparseable. |


| Weeks | Focus | Ships |
| --- | --- | --- |
| 1–2 | Foundation | Data model migration, auth (phone OTP + Google), contacts, analytics instrumentation, WhatsApp Business API application submitted |
| 3–4 | Dates & reminders | Save Special Dates, occasion types incl. Nigerian-specific, scheduled reminder job, notification preferences, T-7 email + push live |
| 5–6 | Wishlists | Create/edit, catalogue items, public /w/{slug} page, share card generation, claim mechanics with auto-release |
| 7–8 | Link unfurling & guest flow | OG parser + fallback cascade, guest checkout end-to-end, delivery windows, gift messages |
| 9–10 | Pooling | Pool creation, /p/{slug}, PSP escrow integration, contributor wall, refund path, completion notifications |
| 11 | Fulfilment & reveal | Courier photo capture, giver notification, thank-you loop, giving history |
| 12 | Hardening | Low-bandwidth testing on mid-range Android, load test the public pages, WhatsApp templates live, soft launch |


