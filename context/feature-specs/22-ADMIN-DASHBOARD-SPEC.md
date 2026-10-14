# Feature: Admin Dashboard

## Source reference
`Givftme-07-Admin-and-Data-Layer.docx` — BendingWaters spec document defining 12 admin screens, the event log, roles, messaging engine, and privacy rules. This spec implements that document faithfully plus additions from the existing feature specs (reviews moderation, pool payouts queue, business enquiries, reminder failure monitoring).

---

## Overview
An internal dashboard at `/admin/*` inside the main Next.js app. Protected by middleware — only authenticated users with a non-null `role` on `public.users` can access it. Five roles: `support`, `operations`, `growth`, `finance`, `admin`. Every admin action is logged (who viewed what, who changed what, when). The event log is the foundation — everything else is a view over it.

---

## Route structure
```
app/
  admin/
    layout.tsx              — admin shell: sidebar nav + top bar + role guard
    page.tsx                → redirect to /admin/pulse
    pulse/page.tsx          — Screen 1: live operational dashboard
    growth/page.tsx         — Screen 2: activation funnel + cohorts
    calendar/page.tsx       — Screen 3: reminder performance + streaks
    wishlists/page.tsx      — Screen 4: sharing + viral loop
    pools/page.tsx          — Screen 5: group gifting + payouts queue
    demand/page.tsx         — Screen 6: demand intelligence
    orders/
      page.tsx              — Screen 7: orders list + operations
      [id]/page.tsx         — order detail + status update
    corporate/page.tsx      — Screen 8: company accounts
    diaspora/page.tsx       — Screen 9: international flows
    segments/page.tsx       — Screen 10: segments + exports
    money/page.tsx          — Screen 11: revenue + margin
    people/
      page.tsx              — Screen 12: user search
      [id]/page.tsx         — single person record
    reviews/page.tsx        — Reviews moderation (addition from reviews spec)
    enquiries/page.tsx      — Business page form submissions
    reminders/page.tsx      — Reminder failure monitoring
```

---

## Auth & roles

### Database change — add `role` to `public.users`
```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role TEXT
  CHECK (role IN ('support','operations','growth','finance','admin'))
  DEFAULT NULL;

CREATE INDEX IF NOT EXISTS users_role_idx ON public.users(role) WHERE role IS NOT NULL;
```
`NULL` = regular customer. Non-null = admin team member. First admin must be set directly in Supabase dashboard.

### Middleware
`src/middleware.ts` — extend the existing middleware:
```typescript
// Admin routes
if (pathname.startsWith('/admin')) {
  if (!session) return redirect('/auth/login?redirect=' + pathname)
  const { data: profile } = await supabase.from('users').select('role').eq('id', session.user.id).single()
  if (!profile?.role) return redirect('/?error=unauthorized')
}
```

### Role permission matrix
| Screen | support | operations | growth | finance | admin |
|---|---|---|---|---|---|
| Pulse | ✓ | ✓ | ✓ | ✓ | ✓ |
| Growth & Cohorts | — | — | ✓ | — | ✓ |
| Calendar Engine | — | ✓ | ✓ | — | ✓ |
| Wishlists & Sharing | — | — | ✓ | — | ✓ |
| Pools | — | ✓ | ✓ | ✓ | ✓ |
| Demand Intelligence | — | — | ✓ | — | ✓ |
| Orders & Operations | — | ✓ | — | ✓ | ✓ |
| Corporate | — | ✓ | ✓ | ✓ | ✓ |
| Diaspora | — | — | ✓ | ✓ | ✓ |
| Segments & Exports | — | — | ✓ | — | ✓ |
| Money | — | — | — | ✓ | ✓ |
| People | ✓ | ✓ | ✓ | — | ✓ |
| Reviews | ✓ | — | ✓ | — | ✓ |
| Enquiries | — | ✓ | ✓ | — | ✓ |
| Reminder failures | — | ✓ | — | — | ✓ |

---

## Event log

### Database table
```sql
CREATE TABLE events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event       TEXT        NOT NULL,
  user_id     UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  anon_id     TEXT,                    -- anonymous id from first visit, pre-signup
  session_id  TEXT,
  device      TEXT,                    -- 'mobile' | 'desktop' | 'tablet'
  platform    TEXT,                    -- 'web' | 'ios' | 'android'
  city        TEXT,
  country     TEXT        DEFAULT 'NG',
  props       JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for the queries the admin screens need
CREATE INDEX events_event_idx         ON events(event);
CREATE INDEX events_user_id_idx       ON events(user_id);
CREATE INDEX events_created_at_idx    ON events(created_at DESC);
CREATE INDEX events_event_ts_idx      ON events(event, created_at DESC);
CREATE INDEX events_props_idx         ON events USING gin(props);

-- Append-only: no UPDATE or DELETE via RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only writes" ON events FOR INSERT WITH CHECK (true);
CREATE POLICY "No updates ever"          ON events FOR UPDATE USING (false);
CREATE POLICY "No deletes ever"          ON events FOR DELETE USING (false);
-- Admin reads handled via service role (bypasses RLS)
```

### Event catalogue (from document section 9)
Fire these from the relevant API routes and server actions:

| Event | Fires in | Key props |
|---|---|---|
| `user_signed_up` | `handle_new_user` trigger or auth callback | `source`, `channel`, `city`, `referrer_list_id` |
| `date_saved` | `POST /api/important-dates` | `occasion`, `relationship`, `days_until`, `has_gift_note` |
| `reminder_sent` | `/api/reminders` cron | `channel`, `days_before`, `message_id`, `flow` |
| `reminder_opened` | Email open pixel / link click | `channel`, `days_before` |
| `reminder_actioned` | Any order/purchase within 48hr of reminder | `channel`, `days_before`, `order_id` |
| `date_missed` | Archive cron when occasion passes with no order | `occasion`, `days_late` |
| `date_recovered` | Order placed after date passed | `days_late` |
| `wishlist_created` | `POST /api/occasions` or evergreen auto-create | `type`, `item_count` |
| `wishlist_item_added` | `POST /api/wishlists/[id]/items` | `origin`, `price_set`, `category`, `price_band` |
| `wishlist_shared` | `GET /api/wishlists/[id]/share-link` | `destination` |
| `wishlist_opened` | `/w/[token]` page load | `is_new_visitor`, `referrer` |
| `item_claimed` | `POST /api/purchases` | `value`, `is_pooled`, `origin` |
| `pool_created` | `POST /api/pools` | `type`, `target_amount` |
| `pool_contributed` | Flutterwave webhook (pool path) | `amount`, `pool_pct_after` |
| `pool_completed` | When `amount_raised >= target_amount` | `contributor_count`, `total_raised` |
| `search_performed` | `/search` page or `/api/search` | `query`, `result_count`, `clicked` |
| `order_placed` | Flutterwave webhook (order path) | `items`, `value`, `lead_time_days`, `channel` |
| `order_delivered` | Status update to `delivered` | `on_time`, `area`, `days_from_placed` |
| `review_submitted` | `POST /api/reviews` | `rating`, `has_body` |
| `pool_payout_requested` | `POST /api/pools/[id]/cash-out` | `amount`, `pool_type` |
| `admin_action` | Any admin route mutation | `action`, `target_type`, `target_id`, `admin_id` |

### Client-side event helper
```typescript
// lib/events/track.ts
export async function track(event: string, props: Record<string, unknown> = {}) {
  try {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, props }),
    })
  } catch {} // fire-and-forget, never block the user
}
```

### `POST /api/events`
Accepts event name + props from client. Reads session from cookie, fills in user_id. Writes to `events` table via service role. Never returns an error to the client — always 200.

---

## Database changes summary

```sql
-- 1. Role on users (above)
-- 2. Events table (above)
-- 3. Admin action log
CREATE TABLE admin_actions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID        NOT NULL REFERENCES public.users(id),
  action      TEXT        NOT NULL,   -- 'view_person', 'update_order_status', 'delete_review', etc.
  target_type TEXT,                   -- 'user', 'order', 'review', 'pool', etc.
  target_id   TEXT,
  metadata    JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX admin_actions_admin_idx  ON admin_actions(admin_id);
CREATE INDEX admin_actions_target_idx ON admin_actions(target_type, target_id);

-- 4. Business enquiries (from /business page form)
CREATE TABLE business_enquiries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name    TEXT        NOT NULL,
  contact_name    TEXT        NOT NULL,
  email           TEXT        NOT NULL,
  phone           TEXT,
  occasions       TEXT[]      DEFAULT '{}',
  team_size       TEXT,
  needed_by       DATE,
  notes           TEXT,
  status          TEXT        NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new','contacted','qualified','won','lost')),
  assigned_to     UUID        REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX business_enquiries_status_idx ON business_enquiries(status);
```

---

## Screen 1: Pulse

**Route:** `/admin/pulse`
**Roles:** all

### Layout
Top row: 7 KPI cards (signups today, active today, dates saved today, lists created, links shared, orders placed, ₦ collected). Each card shows today's number, yesterday's number (↑↓ delta), and a sparkline of the last 7 days.

Second row: Operations strip — gifts due today, out for delivery, delivered, late, failed deliveries.

Third row: "Needs a human" panel — failed payments (`orders` where `status='payment_failed'` and `created_at > now() - 24h`), failed reminders (`reminders` where `permanently_failed=true` and `sent_at` is null), delivery exceptions (`orders` where `status='shipped'` and estimated_delivery < today and `status != 'delivered'`), pool payouts pending (`pool_payouts` where `status='pending_ops_action'`), business enquiries unread (`business_enquiries` where `status='new'`).

Each "needs a human" row is a link to the relevant admin screen.

### Data queries
All queries use the service role Supabase client. KPI counts are direct `COUNT(*)` queries with date filters. Sparklines fetch 7 rows from the `events` table grouped by `created_at::date`.

---

## Screen 2: Growth & Cohorts

**Route:** `/admin/growth`
**Roles:** growth, admin

### Activation funnel
Horizontal funnel chart. Each step is a count from the `events` table:
- Signed up: `COUNT(*) WHERE event='user_signed_up'`
- Saved 1 date: users with ≥1 `date_saved` event
- Saved 3+ dates: users with ≥3 `date_saved` events
- Created wishlist: users with ≥1 `wishlist_created`
- Shared a link: users with ≥1 `wishlist_shared`
- First order: users with ≥1 `order_placed`
- Second order: users with ≥2 `order_placed`

Drop-off percentage between each step shown as red text.

### Cohort retention table
Group `user_signed_up` events by ISO week. For each cohort week, calculate % still active (any event) at day 7, 14, 30, 60, 90. Render as a heat-map table — darker green = better retention.

### Lifecycle segments panel
Each segment from the document rendered as a count card with an "Export" button. Export calls `GET /api/admin/segments/[segment-id]/export` which returns a CSV of user_id, name, email, phone, city, next_date.

---

## Screen 3: Calendar Engine

**Route:** `/admin/calendar`
**Roles:** operations, growth, admin

### Components
- Bar chart: dates saved by month × occasion type
- Donut: occasion mix (birthdays, weddings, naming ceremonies, etc.)
- Table: reminder performance — for each (channel × days_before) combination: sent, opened, actioned, conversion rate
- Histogram: lead time distribution (days between order_placed and the occasion date)
- Missed dates: count by month, with recovery rate
- Streak leaderboard: top 20 users by longest active streak (months without a missed date)

---

## Screen 4: Wishlists & Sharing

**Route:** `/admin/wishlists`
**Roles:** growth, admin

Metrics table with period selector (7d / 30d / 90d / all time):
- Lists created
- Avg items per list
- Items with no price (from `wishlist_items` where `price IS NULL`)
- Item source breakdown (origin=external scraped / external manual / catalog)
- Share rate (lists shared / lists created)
- Avg opens per share
- Claims per open
- New signups attributed to a list (from `user_signed_up` events where `referrer_list_id` is set)
- K-factor (new accounts per list shared)

Top 10 most-shared wishlists table: receiver name (masked to initials for privacy), occasion, share count, claim count, new signups attributed.

---

## Screen 5: Pools

**Route:** `/admin/pools`
**Roles:** operations, growth, finance, admin

### Two tabs

**Active pools tab**
Table of all `open` and `fully_funded` pools:
- Pool title, receiver, type (item/general), target, raised, %, contributor count, created date
- Quick action: "View" → pool detail

**Payouts queue tab** ← critical ops workflow
Table of `pool_payouts` where `status='pending_ops_action'`, ordered by `created_at ASC`:
- Pool title, receiver name + email, amount to pay, requested date
- "Mark processing" button → updates `pool_payouts.status='processing'`
- "Mark completed" button → modal asking for: bank name, account number, account name, reference — then updates to `completed`
- All payout actions logged to `admin_actions`

---

## Screen 6: Demand Intelligence

**Route:** `/admin/demand`
**Roles:** growth, admin

### Panels
- Most wished-for items table: item title (from `wishlist_items.title`), count, avg price, top occasion, top city — with period filter and occasion filter
- Most searched terms: from `search_performed` events, `props->>'query'` grouped by count, split by "returned results" vs "returned nothing"
- Zero-result searches: sorted by frequency — this is the shopping list
- Pasted link domains: from `wishlist_items` where `origin='external'`, `product_url` domain extracted and counted
- Wanted vs bought gap: items wishlisted count vs items claimed count, by category

---

## Screen 7: Orders & Operations

**Route:** `/admin/orders`
**Roles:** operations, finance, admin

### Orders list
Filterable table:
- Filters: status (all / pending / confirmed / shipped / delivered / failed / cancelled), date range, city, amount range
- Columns: order ID (short), buyer name, items (count + first item title), total, status badge, city, placed date, delivery date
- Click row → `/admin/orders/[id]`

### Order detail page (`/admin/orders/[id]`)
Full order: buyer info, line items with unit prices, shipping address, status history timeline.

**Status update panel** (operations + admin only):
- Status selector (only valid next statuses shown — enforces the transition machine)
- Tracking number input (shown when moving to `shipped`)
- Carrier name input
- Tracking URL input
- Notes textarea
- "Update status" button → `PATCH /api/admin/orders/[id]/status` (service role, triggers `on_order_status_changed` DB trigger)

---

## Screen 8: Corporate

**Route:** `/admin/corporate`
**Roles:** operations, growth, finance, admin

Table of company accounts (users with `role IS NULL` but associated with a `business_enquiries` row that reached `won` status — or a `corporate_accounts` table if one is added).

Columns: company, plan, campaigns run, last campaign date, total spend, account manager, status (healthy / drifting / at-risk).

Clicking a company → all their orders, campaigns, team members, and communication history.

---

## Screen 9: Diaspora

**Route:** `/admin/diaspora`
**Roles:** growth, finance, admin

Map + table showing:
- Orders placed by users where `country != 'NG'` (from `events.country`)
- Source countries, count, total value
- Receivers (in Nigeria) for diaspora-placed orders
- Most common occasion types from diaspora givers

---

## Screen 10: Segments & Exports

**Route:** `/admin/segments`
**Roles:** growth, admin

All lifecycle segments from the document rendered as cards:
- Segment name, definition, current count, last refreshed
- "Preview" button (shows first 10 rows)
- "Export CSV" button → `GET /api/admin/segments/[id]/export`
- "Message" button (future — trigger a Resend campaign)

Each segment is a named SQL query against the `events` table + `users` table. Computed on-demand (not pre-materialised in v1).

---

## Screen 11: Money

**Route:** `/admin/money`
**Roles:** finance, admin

### Panels
- Revenue by line: catalog orders, gift cards, business plans — period selector
- Avg order value trend (30-day rolling)
- Planner's Rate distribution: histogram of `order_placed` events grouped by `props->>'lead_time_days'`
- Gift cards: issued vs redeemed vs outstanding (liability)
- Refunds: amount, reason, approved by — table

---

## Screen 12: People

**Route:** `/admin/people`
**Roles:** support, operations, growth, admin (not finance)

### Search page
Search by name, email, or phone. Returns matching users with: name, email, city, signup date, role badge (if admin), last active date.

### Person detail page (`/admin/people/[id]`)
All blocks from document section 8:
- **Profile:** name, phone, email, city, signup date + source, language, Plus status, role
- **Their calendar:** saved dates with occasion, relationship, next upcoming, streak count, missed dates list
- **Lists & pools:** all wishlists with item count, share count, claim count; pools created/contributed to
- **Orders:** all orders, status, value, delivery status
- **Messages:** all `reminder_sent` events for this user — channel, days_before, message_id, opened/actioned
- **Activity timeline:** all events for this user, newest first (raw `props` shown in a `<pre>` block)
- **Value:** total spent (sum of confirmed orders), gifts given (purchases made), gifts received (purchases on their items), estimated LTV
- **Consent & privacy:** marketing consent per channel, data export button (`GET /api/admin/people/[id]/export`), delete account button (requires "DELETE" confirmation + reason — triggers the same account deletion as the customer-facing flow but logged to `admin_actions`)

Every visit to a person's page logs an `admin_action` row: `action='view_person'`, `target_type='user'`, `target_id=userId`.

---

## Screen 13: Reviews (addition)

**Route:** `/admin/reviews`
**Roles:** support, growth, admin

Table of all reviews, newest first. Filters: rating (1★–5★), product, date range.
Columns: reviewer (name), product (Sanity title), rating, body (truncated), date, actions.

Actions per row:
- "View product" → Sanity Studio product URL
- "Delete" → confirmation dialog → `DELETE /api/admin/reviews/[id]` (service role) → logs to `admin_actions`

---

## Screen 14: Business Enquiries (addition)

**Route:** `/admin/enquiries`
**Roles:** operations, growth, admin

Table of `business_enquiries`, grouped by status (new / contacted / qualified / won / lost).
Columns: company, contact, email, phone, occasions, team size, needed by, received date.

Actions:
- Status update (dropdown)
- Assign to team member (dropdown of admin users)
- Notes field (inline edit)

---

## Screen 15: Reminder Failures (addition)

**Route:** `/admin/reminders`
**Roles:** operations, admin

Table of `reminders` where `permanently_failed=true`.
Columns: user name + email, occasion, channel, scheduled_at, retry_count, last_attempted.
Actions:
- "Retry" → resets `permanently_failed=false`, `retry_count=0` → will be picked up on next cron run
- "Mark dismissed" → sets a `dismissed` flag (add column)

---

## Admin shell layout

`app/admin/layout.tsx` — wraps all admin pages.

**Sidebar** (desktop, collapsible):
Grouped nav:
- Overview: Pulse
- Growth: Growth & Cohorts, Calendar Engine, Wishlists, Segments
- Operations: Orders, Pools, Reminder Failures
- Intelligence: Demand, Corporate, Diaspora
- Finance: Money
- People: People, Reviews
- Business: Enquiries

Only shows links the current user's role can access (filter against the permission matrix).

**Top bar:**
- Page title (breadcrumb)
- Admin user avatar + name + role badge
- Global search (searches people by name/email — only available to roles with People access)

**Mobile:** sidebar collapses to a hamburger → drawer.

---

## API routes (admin-only)

All under `/api/admin/*`. All verify the requesting user has a non-null `role` using the service role client. All log to `admin_actions`.

```
POST   /api/events                              — client-side event tracking
GET    /api/admin/pulse                         — all Pulse KPIs in one call
GET    /api/admin/growth/funnel                 — activation funnel counts
GET    /api/admin/growth/cohorts                — cohort retention matrix
GET    /api/admin/segments/[id]                 — segment count + preview
GET    /api/admin/segments/[id]/export          — CSV download
GET    /api/admin/orders                        — orders list with filters
PATCH  /api/admin/orders/[id]/status            — update order status
GET    /api/admin/pools/payouts                 — pending payouts
PATCH  /api/admin/pools/payouts/[id]            — update payout status
GET    /api/admin/people                        — user search
GET    /api/admin/people/[id]                   — full person record
GET    /api/admin/people/[id]/export            — GDPR data export (ZIP of JSON)
DELETE /api/admin/people/[id]                   — account deletion with reason
DELETE /api/admin/reviews/[id]                  — delete a review
PATCH  /api/admin/enquiries/[id]                — update enquiry status/assignee
PATCH  /api/admin/reminders/[id]/retry          — reset a permanently failed reminder
POST   /api/business/enquiry                    — public: submit business form
```

---

## Privacy rules (from document section 11)

Enforced in code, not just policy:
1. No published aggregate may describe fewer than 50 people — all segment exports strip records if count < 50.
2. Claims are never visible to the wishlist owner — the People screen shows claims made *by* this person, never claims *on their items* attributed to specific givers.
3. Sympathy/remembrance dates (`occasion_type IN ('remembrance', 'sympathy')`) are excluded from all segment exports and messaging queries.
4. Every admin page view and mutation is logged to `admin_actions`.
5. Marketing consent is stored per channel with date and source — never message a user who hasn't consented to that channel.

---

## Build order

1. **Event log + `POST /api/events` + client `track()` helper.** Wire into the 4 most critical call sites first: `user_signed_up`, `order_placed`, `wishlist_shared`, `date_saved`. Everything else can follow.
2. **Admin auth middleware + role column + admin shell layout** (sidebar + top bar, permission-filtered).
3. **Pulse screen** — the first thing the ops team needs.
4. **Orders screen + order detail with status update** — unblocks ops from Retool dependency.
5. **People screen** — unblocks support.
6. **Pools payouts queue** — unblocks finance.
7. **Growth & Cohorts + Segments & Exports** — unblocks growth/marketing.
8. **Remaining screens** — Calendar Engine, Wishlists, Demand Intelligence, Money, Reviews, Enquiries, Reminders.

---

## Acceptance criteria
- [ ] `events` table exists, append-only via RLS, service-role write from `POST /api/events`
- [ ] `role` column on `public.users`, middleware blocks non-role users from `/admin/*`
- [ ] All 5 roles see only their permitted screens in the sidebar
- [ ] Every admin mutation logs to `admin_actions`
- [ ] Pulse screen shows live KPIs with 7-day sparklines and the "needs a human" queue
- [ ] Orders screen allows status update with valid transition enforcement
- [ ] People screen shows the full person record across all data sources
- [ ] Pool payouts queue shows pending payouts with mark-processing and mark-completed actions
- [ ] Segments screen shows all lifecycle segments with export to CSV
- [ ] Privacy rules enforced: no < 50 aggregates, no claim attribution, no sympathy segments
