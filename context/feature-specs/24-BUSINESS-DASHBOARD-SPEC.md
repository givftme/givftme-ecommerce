# Feature: Gifvtme for Business — HR Dashboard

## Source reference
`givftme-business-dashboard.html` — a complete 934-line single-file HTML prototype with full Vanilla JS, localStorage state, CSV parsing, a 3-step campaign wizard, and 13 distinct views. Port faithfully to the Gifvtme Next.js 16 stack.

---

## Overview
A standalone authenticated web app at `/business-dashboard` for HR and brand managers at Nigerian companies that use Gifvtme's corporate gifting service. It is completely separate from the customer-facing Gifvtme platform and the internal admin dashboard. Users are companies, not individuals. It lets HR teams:

- Upload staff and client lists (CSV or paste)
- Track every birthday, work anniversary, and company occasion on a gifting calendar
- Plan and approve gifting campaigns
- Set automatic gifting rules
- Manage their brand kit (logo, colour, message)
- View proof of delivery photos
- Track budget and invoices

This dashboard connects to the same Supabase database but through a **separate auth flow and data model** — company accounts, not individual consumer accounts.

---

## Route
`/business-dashboard` — protected route. Unauthenticated users see the sign-in screen. This is a **single-page application** structure: one layout shell, content swapped by client-side navigation (no full-page navigations between views, matching the source's design).

---

## How it fits into the project

### New tables (see Database Changes below)
- `business_accounts` — company-level account
- `business_users` — employees of a company who can access the dashboard (HR, Finance, MD)
- `business_people` — the staff/clients whose occasions are tracked
- `business_campaigns` — gifting campaigns planned by the company
- `business_rules` — automatic gifting rules per company
- `business_deliveries` — proof of delivery records

### Relationship to existing tables
- `business_campaigns` links to `orders` when a campaign is fulfilled (the ops team creates the order in Retool and links it back)
- `business_people.bday` + `business_people.start` feed events into the `events` table as `date_saved` events attributed to the company account — this is how the admin Growth/Calendar screens count business-sourced dates

### Auth model
Business dashboard users sign in at `/business-dashboard/auth`. They are stored in `business_users`, not `public.users`. A separate Supabase Auth flow using a different `user_metadata.account_type = 'business'` flag, OR a completely separate email/password check against `business_users` using a server action that returns a session token stored in a cookie. **Recommendation: use Supabase Auth with the existing `public.users` table, add `account_type TEXT DEFAULT 'consumer'` column, set to `'business'` for business accounts. Business dashboard middleware checks `account_type = 'business'`.**

---

## Design system

**Use the Gifvtme project design system — no new tokens.** See `context/design/DESIGN_SYSTEM.md` for the full reference. Do not introduce custom CSS variables, a separate globals.css, or a scoped token block for this feature.

Mapping from the HTML source to the project design system:

| Source token | Project equivalent | Tailwind class |
|---|---|---|
| `--red` / `--brand` | `--color-brand` `#C50404` | `brand` |
| `--ink` | `--color-ink` `#000000` | `ink` |
| `--muted` | `--color-muted` `#4A4A4A` | `muted` |
| `--soft` | `--color-surface` `#F7F7F7` | `surface` |
| `--line` | Tailwind `border-stone-200` or `border-[#E5E7EB]` | — |
| `--green` | Tailwind `text-green-700` / `bg-green-50` | — |
| `--blue` | Tailwind `text-blue-700` / `bg-blue-50` | — |
| `--purple` | Tailwind `text-purple-700` / `bg-purple-50` | — |
| `--amber` | Tailwind `text-amber-700` / `bg-amber-50` | — |

**Buttons:** use `components/ui/button.tsx` (shadcn, customised to brand). The source's `.btn-brand` = `filled` variant, `.btn-line` = `outline` variant, `.btn-ghost` = `ghost` variant, `.btn-ink` = `filled` with `bg-ink`. Buttons are `rounded-full` per the design system.

**Cards:** `rounded-2xl border border-stone-200 bg-white` — matches the project's card style.

**Fonts:** Inter (the project font) via the existing `next/font/google` setup in the root layout. No Belleza or Poppins. Headings use Inter Bold, not a display font. The visual character of the dashboard should match the rest of Gifvtme, not diverge with a separate typeface.

**Icons:** `lucide-react` — already in the project stack. The source uses the same Lucide icon set (loaded via CDN), so icon names port directly.

**Status pills:** use `components/ui/badge.tsx` (shadcn Badge) with the project's existing variant set, extending it if needed for business-specific statuses (Draft, Pending approval, Approved, Delivered).

**Per-company brand colour (`business_accounts.brand_color`):** this is the one intentional runtime CSS variable. Apply it inline on the dashboard shell element: `style={{ '--company-brand': account.brand_color }}`. Use `var(--company-brand)` only in components that intentionally reflect the company's brand (the brand kit preview, the sidebar company mark). The rest of the UI uses the standard `brand` token (`#C50404`).

**No separate layout file for fonts** — the business dashboard layout.tsx only needs metadata and the auth guard. It does not load additional fonts.

---

## Architecture decision: server vs client rendering

The source is a fully client-side SPA with localStorage. In Next.js, the correct split is:

- **Shell (`BusinessDashLayout`):** server component — fetches the company account, user, and initial data server-side.
- **Each view:** client component — receives initial data as props from the server, manages local UI state client-side.
- **State:** Supabase (not localStorage) — all data is persisted to the DB via server actions or API routes.
- **View switching:** client-side only — no URL change per view. Use a `useState('overview')` in the shell's client wrapper. This matches the source's SPA pattern and avoids full-page navigations.
- **Exception:** the import wizard and campaign wizard are complex client-only flows that manage step state locally — they open as modals and only POST to the server on final confirmation.

---

## Component breakdown

```
app/
  business-dashboard/
    layout.tsx                  — metadata, auth guard (no additional fonts needed)
    page.tsx                    → redirects to auth if not signed in, renders the shell
    auth/
      page.tsx                  — Sign in / Create account screen (the sign-in section from source)

components/business-dashboard/
  BizDashShell.tsx              — "use client" — sidebar + topbar + view switcher
  BizDashSidebar.tsx            — dark sidebar nav matching source exactly
  BizDashTopbar.tsx             — search, Add person, New campaign CTAs
  views/
    BizOverview.tsx             — Overview (4 stats, next 30 days, proof, needs attention, quick actions)
    BizUpcoming.tsx             — Upcoming moments (grouped by month)
    BizStaff.tsx                — Staff table with checkboxes, dept filter, bulk actions
    BizClients.tsx              — Clients & partners table
    BizImport.tsx               — Bulk upload — 3-step wizard (drop/paste → map columns → review & import)
    BizCampaigns.tsx            — Campaigns grid with status filter and new campaign wizard
    BizCalendar.tsx             — Year calendar (12-month grid) + occasion planning
    BizRules.tsx                — Automatic rules with toggle switches
    BizProof.tsx                — Deliveries / proof of delivery photos grid
    BizBudget.tsx               — Budget & invoices
    BizBrand.tsx                — Brand kit (colour, logo, message, live preview)
    BizTeam.tsx                 — Team & approvals
  modals/
    PersonModal.tsx             — Add / edit a staff member or client
    CampaignWizard.tsx          — New campaign — 3-step wizard
    BriefModal.tsx              — Send a brief to the Experience Centre

lib/
  business-dashboard/
    data.ts                     — occasions, gifts, audience options, rules defaults, Nigerian data
    actions.ts                  — all server actions (importPeople, saveCampaign, saveBrand, etc.)
    queries.ts                  — Supabase query helpers scoped to a business_account_id
    utils.ts                    — nextOccurrence(), daysTo(), initials(), colorPalette(), parseDate(), parseCSV(), formatNaira()
```

---

## Screen 1: Sign in / Create account

**Route:** `/business-dashboard/auth`

Two tabs: "Sign in" and "Create a business account".

**Sign in:** email + password form. "Continue with company Google / Microsoft" SSO button (can be wired to Supabase Google OAuth in v1).

**Create account:** company name (required), work email, role (select: HR/People, Admin, Marketing/Brand, Executive Assistant, Finance, Founder/MD), password. On submit: create a `public.users` row with `account_type='business'`, create a `business_accounts` row, create a `business_users` row linking the two.

**Left panel (desktop only):** dark ink (`bg-ink`) panel with the headline "Upload your team once. We'll remember everybody's day." + 4 feature bullet points (from source). Hidden on mobile. Uses Inter font consistent with the rest of Gifvtme.

**After auth:** redirect to `/business-dashboard` → shell renders with `view='overview'`.

---

## Screen 2: Overview

**4 stat cards:**
- Moments in the next 30 days (count from `upcoming(30)`)
- People on file (staff count + clients count)
- Budget used (% of annual budget, with ₦ amounts)
- Waiting for approval (pending campaigns count, with amber pill if > 0)

**Two-column layout (desktop: 1.4fr + 1fr):**

Left column:
- "Next 30 days" card — list of upcoming moments (first 7), each row: avatar initials + name + type + "in X days" chip (amber if ≤ 7 days) + date. "See all" link → upcoming view.
- "Proof of delivery" card — last 3 delivery photos. "All deliveries" link.

Right column:
- "Needs your attention" card — campaigns pending approval, each with Approve button. "Nothing waiting." if clear.
- Quick actions card — 4 ghost buttons: Upload the staff list, Plan Customer Service Week, Update brand kit, Export year schedule.
- Experience Centre card (dark ink bg) — "Planning something bigger?" + "Send a brief" CTA.

---

## Screen 3: Upcoming moments

Grouped by month (YYYY-MM). Each group: section header with month + year + count, then a card with a list of all moments in that month.

Each row: avatar initials (colour from name hash), name, type (Birthday / N years / Campaign), sub-label (dept + role, or campaign audience), "in X days" chip, date.

Export schedule CSV button at the top. "Change automatic rules" button.

---

## Screen 4: Staff

Filterable table with:
- Department filter (select)
- Bulk upload button
- Add one button
- Select all checkbox
- Per-row: checkbox, avatar + name, department, role, birthday (with days until), start date, next milestone (e.g. "5 years · 14 Mar"), gift tier (Standard / Premium / Signature pill), edit button

**Bulk actions bar** (shown when rows selected): "Set gift tier", "Add to a campaign", "Remove".

Clicking edit → PersonModal.

---

## Screen 5: Clients & partners

Same table structure as Staff but columns: company, relationship, birthday, account owner.

---

## Screen 6: Bulk Upload (3-step wizard)

**Step 1 — Upload:** Two sub-tabs (Staff | Clients). Drag-and-drop zone or file picker (CSV only). "Or paste rows from Excel" — hidden details element with a textarea. Download template button.

**Step 2 — Map columns:** Auto-detects column mapping from headers. Grid of fields (required: name, birthday; optional: department, role, start date for staff; company, relationship, owner for clients). Each field has a "from" label + a `<select>` of CSV columns. Preview of first 4 rows below.

**Step 3 — Review:** Stats (good rows, duplicates skipped, rows with problems). Error list for bad rows. Preview table of first 8 good rows. "Import N people" CTA. On confirm: inserts into `business_people` and shows success toast.

**CSV parsing rules (from source — port exactly):**
- Comma or tab delimited
- Quoted fields with escaped quotes
- Date formats: `DD/MM/YYYY`, `YYYY-MM-DD`, `DD MMM YYYY`, `MMM DD YYYY` (Nigerian order: day first)
- Birth year optional — day+month only is fine
- Duplicates detected by name (case-insensitive)
- Bad rows: missing name, unparseable birthday

---

## Screen 7: Campaigns

**Status filter tabs:** All | Draft | Pending approval | Approved | Delivered

**Campaign cards grid** (`auto-fill, minmax(290px, 1fr)`):
Each card: occasion icon + colour, campaign name, audience, status pill, delivery date + countdown, people count, per-person cost + delivery fee, gift type, estimated total. Footer actions:
- Draft: "Send for approval" button
- Pending approval: "Approve" button
- Approved/Delivered: "Send to Experience Centre" button
- All: "Edit" + delete (trash icon) buttons

**New campaign → 3-step wizard (modal):**

Step 1 — Occasion: grid of 10 occasion cards (Birthdays, Work anniversaries, CSW, Mother's Day, Father's Day, Eid/Sallah, Independence Day, End of year, New baby/wedding, Sympathy). Click selects. Campaign name input below.

Step 2 — Who & what: audience selector (Everyone / One department / Staff who are mothers / Staff who are fathers / Clients and partners / Executives), heads count (auto-fills from audience), delivery date, gift selector (Branded cake pack / Treat pack / Hamper / Gift card / Signature gift), per-person budget input.

Step 3 — Review: summary card with all details + estimated total + tight-timing warning if delivery < 21 days. Message on card textarea. "Send to Finance for approval" checkbox. "Create campaign" CTA.

---

## Screen 8: Year Calendar

12-month grid (4 columns). Each month card:
- Month name + year
- Count of birthdays (brand red dot)
- Count of work anniversaries (purple dot)
- Campaign names if any (green dot) — or "No campaign planned" (grey dot)
- Click opens a month detail view (just filters the Upcoming moments to that month)

Below grid: "Moments most companies plan for" — 10 occasion cards from the OCCASIONS constant. Each with "Plan this" CTA that opens the campaign wizard pre-selected to that occasion.

---

## Screen 9: Automatic Rules

Six toggle-switch rules (from source):
1. Staff birthdays (on by default)
2. Work anniversaries (1, 3, 5, 10 years) (on)
3. New babies and weddings (off)
4. Client and partner birthdays (on)
5. Sympathy packages (on)
6. Remind me when a month is quiet (on)

Each rule: title, description, toggle switch. Toggle state saved to `business_rules`.

**"Who gets the reminders" card:**
- Main contact (text input)
- Copy on everything (email input)
- How we reach you (select: WhatsApp and email / Email only / WhatsApp only)
- Auto-approve under (₦ input)
Note: reminders go out 30, 14, and 7 days before anything branded.

---

## Screen 10: Deliveries (Proof of Delivery)

Photo grid of delivery records from `business_deliveries`. Each item:
- Photo (if available) at 4:3 aspect ratio, or "Scheduled" placeholder
- Who: person name + team
- What: occasion + gift type
- When: delivery timestamp or "Scheduled"

**Exceptions section:** cards for failed/redirected deliveries with action buttons.

---

## Screen 11: Budget & Invoices

**4 stat cards:** Approved budget, Spent so far (%), Committed (approved campaigns), Per person per year.

**Budget bar:** double-layer bar (spent + committed vs total budget). Warning if >85% committed.

**Campaigns cost breakdown table:** name, date, people, per person, total, status.

**Invoices list:** list of past invoices. Each: invoice label, "One invoice, every gift and every office", paid/due pill, Download button.

---

## Screen 12: Brand Kit

**Left: form**
- Company name
- Brand colour (color picker + hex input, synced)
- Logo upload (PNG/SVG, stores as base64 or Supabase Storage URL on `business_accounts.logo_url`)
- Default message on cards (textarea)
- "Save brand kit" button

**Right: live preview**
3 mock cards updating in real time as form changes:
- Branded cake pack: brand colour background, logo, message
- Gift box sleeve: ink background, logo, "Happy birthday"
- Gift card: brand-to-orange gradient, logo, ₦25,000

**House rules card** below preview.

Saving brand kit updates `business_accounts.brand_color`, `logo_url`, `default_message`, `company_name`.

---

## Screen 13: Team & Approvals

**Team list:** name, department, role/permission level (Admin / Editor / Approver / Limited). Edit button per row.

**Invite colleague button** → toast "Invite sent" in v1.

**Approval flow card:**
HR plans → Finance approves → Givftme produces → Delivered with photos
(shown as a horizontal pill row with arrows)

---

## Data constants (in `lib/business-dashboard/data.ts`)

```typescript
export const OCCASIONS = [
  { key: 'Birthdays',           icon: 'cake',         color: '#C40404', note: 'Runs all year from your staff list' },
  { key: 'Work anniversaries',  icon: 'award',         color: '#6B3FD0', note: 'Milestone years: 1, 3, 5, 10' },
  { key: 'Customer Service Week', icon: 'headset',     color: '#2F5BD3', note: 'First full week of October' },
  { key: "Mother's Day",        icon: 'flower-2',      color: '#C4520A', note: 'March or April — date varies' },
  { key: "Father's Day",        icon: 'user-round',    color: '#119650', note: 'Third Sunday in June' },
  { key: 'Eid / Sallah',        icon: 'moon',          color: '#8A5A00', note: 'Dates change each year' },
  { key: 'Independence Day',    icon: 'flag',          color: '#119650', note: '1 October' },
  { key: 'End of year',         icon: 'gift',          color: '#C40404', note: 'December — staff, clients and partners' },
  { key: 'New baby / wedding',  icon: 'baby',          color: '#6B3FD0', note: 'Life events, logged by HR' },
  { key: 'Sympathy',            icon: 'spa',           color: '#6E6E6E', note: 'Quiet packages — no branding, no fuss' },
]

export const GIFT_TYPES = [
  { label: 'Branded cake pack',  desc: 'Baked and branded with your logo' },
  { label: 'Treat pack',         desc: 'Snacks and drinks, branded sleeve' },
  { label: 'Hamper',             desc: 'Mixed hamper in a branded box' },
  { label: 'Gift card',          desc: 'They choose; your logo on the card' },
  { label: 'Signature gift',     desc: 'Chosen per person, white-glove delivery' },
]

export const AUDIENCES = [
  { label: 'Everyone',                 desc: 'All staff on file' },
  { label: 'One department',           desc: 'Pick a department' },
  { label: 'Staff who are mothers',    desc: "Mother's Day" },
  { label: 'Staff who are fathers',    desc: "Father's Day" },
  { label: 'Clients and partners',     desc: 'From your client list' },
  { label: 'Executives',              desc: 'MD, directors and board' },
]

export const DEPARTMENTS = [
  'Finance','Sales','Operations','Technology','Customer Service',
  'People & Culture','Legal','Executive','Unassigned',
]

export const MILESTONE_YEARS = [1, 3, 5, 10, 15, 20]

export const DELIVERY_FEE_PER_GIFT = 2500 // ₦ — shown in cost estimates
```

---

## Database Changes

```sql
-- Business account (one per company)
CREATE TABLE business_accounts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name     TEXT        NOT NULL,
  brand_color      TEXT        NOT NULL DEFAULT '#C40404',
  logo_url         TEXT,
  default_message  TEXT        NOT NULL DEFAULT 'Thank you for everything you do.',
  plan             TEXT        NOT NULL DEFAULT 'Pulse'
                   CHECK (plan IN ('Pulse','Seasons','Signature')),
  annual_budget    NUMERIC     NOT NULL DEFAULT 0,
  budget_used      NUMERIC     NOT NULL DEFAULT 0,
  delivery_fee     NUMERIC     NOT NULL DEFAULT 2500,
  per_head_default NUMERIC     NOT NULL DEFAULT 18000,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Business dashboard users (HR team members)
CREATE TABLE business_users (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID        NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role              TEXT        NOT NULL DEFAULT 'editor'
                    CHECK (role IN ('admin','editor','approver','limited')),
  department        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, user_id)
);

-- Staff and clients tracked by the company
CREATE TABLE business_people (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID        NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  kind          TEXT        NOT NULL CHECK (kind IN ('staff','client')),
  name          TEXT        NOT NULL,
  department    TEXT,
  role_title    TEXT,
  bday          TEXT        NOT NULL, -- 'MM-DD' format
  start_date    DATE,                 -- for work anniversary milestones (staff only)
  company       TEXT,                 -- client's company (client only)
  relationship  TEXT,                 -- Client / Partner / Vendor / Board (client only)
  account_owner TEXT,                 -- client account owner name (client only)
  tier          TEXT        NOT NULL DEFAULT 'Standard'
                CHECK (tier IN ('Standard','Premium','Signature')),
  active        BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX business_people_account_idx ON business_people(account_id);
CREATE INDEX business_people_bday_idx    ON business_people(bday);

-- Gifting campaigns
CREATE TABLE business_campaigns (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID        NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  occasion      TEXT        NOT NULL,
  audience      TEXT        NOT NULL,
  heads         INTEGER     NOT NULL DEFAULT 1,
  per_head      NUMERIC     NOT NULL DEFAULT 18000,
  delivery_fee  NUMERIC     NOT NULL DEFAULT 2500,
  delivery_date DATE        NOT NULL,
  gift_type     TEXT        NOT NULL,
  card_message  TEXT,
  status        TEXT        NOT NULL DEFAULT 'Draft'
                CHECK (status IN ('Draft','Pending approval','Approved','Delivered')),
  owner         TEXT,
  linked_order_id UUID      REFERENCES orders(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX business_campaigns_account_idx ON business_campaigns(account_id);
CREATE INDEX business_campaigns_status_idx  ON business_campaigns(status);

-- Automatic gifting rules per company
CREATE TABLE business_rules (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID        NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  rule_key    TEXT        NOT NULL,  -- 'staff_birthdays', 'work_anniversaries', etc.
  enabled     BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, rule_key)
);

-- Proof of delivery records
CREATE TABLE business_deliveries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID        NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  campaign_id     UUID        REFERENCES business_campaigns(id) ON DELETE SET NULL,
  recipient_name  TEXT        NOT NULL,
  recipient_group TEXT,
  occasion        TEXT,
  gift_type       TEXT,
  photo_url       TEXT,
  delivered_at    TIMESTAMPTZ,
  status          TEXT        NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled','delivered','failed','rebooked')),
  exception_note  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX business_deliveries_account_idx ON business_deliveries(account_id);

-- Add account_type to public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_type TEXT
  NOT NULL DEFAULT 'consumer'
  CHECK (account_type IN ('consumer','business'));

-- RLS
ALTER TABLE business_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_people    ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_rules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_deliveries ENABLE ROW LEVEL SECURITY;

-- Business users can read/write their own account's data
-- (All policies resolved via business_users join — check account_id matches)
-- Service role used for all server actions.
```

---

## Server Actions (`lib/business-dashboard/actions.ts`)

All use `createServiceClient()`. All validate the current user is a `business_user` for the `account_id` before mutating.

```typescript
importPeople(accountId, people[], kind)           // bulk insert into business_people
upsertPerson(accountId, person)                   // add or update one business_people row
deletePerson(accountId, personId)                 // set active=false
saveCampaign(accountId, campaign)                 // upsert business_campaigns
deleteCampaign(accountId, campaignId)             // delete
approveCampaign(accountId, campaignId)            // status → 'Approved'
sendForApproval(accountId, campaignId)            // status → 'Pending approval'
toggleRule(accountId, ruleKey, enabled)           // upsert business_rules
saveBrand(accountId, brand)                       // update business_accounts
saveReminderSettings(accountId, settings)         // update business_accounts notification prefs
updateBudget(accountId, used)                     // update business_accounts.budget_used
```

---

## API Endpoints

```
POST   /api/business-dashboard/auth/signin        — sign in
POST   /api/business-dashboard/auth/signup        — create account
GET    /api/business-dashboard/people             — list staff + clients
POST   /api/business-dashboard/people/import      — bulk import CSV rows
GET    /api/business-dashboard/campaigns          — list campaigns
GET    /api/business-dashboard/deliveries         — proof of delivery records
GET    /api/business-dashboard/upcoming           — computed upcoming moments
GET    /api/business-dashboard/export-schedule    — CSV download of year's schedule
POST   /api/business-dashboard/brief              — send brief to Experience Centre
                                                    (inserts into business_enquiries)
```

---

## Utility functions (`lib/business-dashboard/utils.ts`)

Port these exactly from the source — they are well-designed and just need TypeScript types added:

```typescript
nextOccurrence(mmdd: string): Date            // given 'MM-DD', returns next occurrence date
daysTo(date: Date): number                    // days from today to date
initials(name: string): string               // 'Ngozi Adeyemi' → 'NA'
colorPalette(name: string): [string, string] // deterministic bg+text color from name
parseDate(value: string): { mm: number; dd: number; yy: number | null } | null
parseCSV(text: string): string[][]           // full RFC 4180 CSV parser
formatNaira(n: number): string               // ₦12,345
formatNairaK(n: number): string              // ₦12k / ₦1.2m
upcomingMoments(people, campaigns, limitDays?): UpcomingMoment[]
campaignCost(campaign, deliveryFee): number
guessColumnMap(headers, kind): Record<string, number>
validateImportRows(rows, headers, map, kind, existing): { ok[], bad[], dupes[] }
milestoneYears(startDate: Date, onDate: Date): number
```

---

## Upcoming moments engine

Port the `upcoming()` function from the source. It computes moments from three sources and merges them into a sorted list:

1. **Staff birthdays:** `nextOccurrence(person.bday)` for each active staff member
2. **Work anniversaries:** for each staff member with a `start_date`, find their next milestone year (1, 3, 5, 10, 15, 20) and include it
3. **Client birthdays:** `nextOccurrence(client.bday)` for each client
4. **Campaigns:** delivery date of each non-Draft campaign

Each moment has: `{ type, who, sub, date, days, tier, kind, id }`. Sorted ascending by `days`. Filtered to `days >= 0` (no past moments shown).

---

## Export CSV format

From source — the export schedule CSV has these columns:
`Date, Type, Name, Details, Days away`

One row per upcoming moment in the next 365 days. Downloaded client-side via a Blob URL.

---

## Permissions (within the business dashboard)

| Action | admin | approver | editor | limited |
|---|---|---|---|---|
| View everything | ✓ | ✓ | ✓ | ✓* |
| Add/edit/delete people | ✓ | — | ✓ | — |
| Create/edit campaigns | ✓ | — | ✓ | — |
| Approve campaigns | ✓ | ✓ | — | — |
| Edit brand kit | ✓ | — | ✓ | — |
| View budget | ✓ | ✓ | ✓ | — |
| Invite team members | ✓ | — | — | — |

*limited: only sees campaigns assigned to their account owner

---

## Validation

### Person add/edit
```typescript
const personSchema = z.object({
  name:          z.string().min(2).max(100),
  bday:          z.string().regex(/^\d{2}-\d{2}$/, 'Must be MM-DD'),
  tier:          z.enum(['Standard','Premium','Signature']),
  department:    z.string().optional(),
  role_title:    z.string().optional(),
  start_date:    z.string().optional(), // ISO date
  company:       z.string().optional(),
  relationship:  z.string().optional(),
  account_owner: z.string().optional(),
})
```

### Campaign
```typescript
const campaignSchema = z.object({
  name:          z.string().min(1).max(200),
  occasion:      z.string().min(1),
  audience:      z.string().min(1),
  heads:         z.number().int().min(1),
  per_head:      z.number().min(0),
  delivery_date: z.string().refine(d => !isNaN(Date.parse(d))),
  gift_type:     z.string().min(1),
  card_message:  z.string().max(300).optional(),
})
```

---

## Error handling

| Scenario | Behavior |
|---|---|
| CSV has no rows | Toast: "That file looks empty" |
| Required column not mapped (name or birthday) | Validation step shows inline error, blocks import |
| Birthday can't be parsed | Row goes to `bad[]` list, rest still import |
| Duplicate name | Row goes to `dupes[]` list, not imported twice |
| Campaign delivery < 21 days away | Amber warning box in Step 3 of wizard |
| Save fails (network) | Toast: "Couldn't save. Please try again." |
| Unauthorised action (role check fails) | Toast: "You don't have permission to do that." |

---

## Toast notifications

A fixed bottom-centre toast (matches source exactly). Shows for 2.6 seconds. One visible at a time. Implemented as a shared `useToast()` hook + `<Toast />` component at the shell level.

---

## Responsive behaviour

- ≤1000px: sidebar becomes a fixed overlay, triggered by burger button. Main columns stack.
- Stats grid: 4 cols → 2 cols on mobile.
- Calendar grid: 4 cols → 2 cols on mobile.
- Campaign wizard mock: 3 cols → 1 col on mobile.
- Sidebar overlay: `position:fixed, left:0, width:260px, z-index:60`. Burger button shown, sidebar hidden by default.

---

## Animation & interaction

No GSAP used in this dashboard (unlike the marketing pages). Uses Inter (project font) throughout. All interactions are CSS transitions:
- Sidebar mobile overlay: `transform: translateX(-102%)` → `translateX(0)`, `transition: transform 0.3s`
- Modal: `opacity 0 + scale(0.98)` → `opacity 1 + scale(1)`, `transition: all 0.25s`
- Toggle switch: `background-color 0.2s`, `transform 0.2s`
- Month cards: `box-shadow + translateY(-2px)` on hover, `transition: 0.2s`
- Respect `prefers-reduced-motion`: all transitions → 0.01ms

---

## Analytics events to fire

On key business dashboard actions:
- `business.account.created` — new company account
- `business.people.imported` (count, kind)
- `business.campaign.created` (occasion, heads, value)
- `business.campaign.approved`
- `business.brand_kit.saved`
- `business.export.schedule`

Use the `logEvent()` helper from `lib/events/track.ts`. Attribute to the company account via `props.account_id`.

---

## Acceptance criteria

- [ ] `/business-dashboard/auth` renders sign-in and create-account tabs.
- [ ] Creating a business account creates `business_accounts` + `business_users` + `public.users` rows atomically.
- [ ] Signing in with a business account loads the dashboard shell at view='overview'.
- [ ] All 13 views render with real data from Supabase (not hardcoded demo data).
- [ ] Upcoming moments engine correctly computes next birthdays, work anniversaries at milestone years, and campaign dates.
- [ ] CSV bulk import: 3-step wizard works end-to-end — file/paste → map → validate → insert into `business_people`.
- [ ] Campaign wizard: 3 steps → creates `business_campaigns` row with correct status.
- [ ] Toggle switches on automatic rules page persist to `business_rules`.
- [ ] Brand kit saves to `business_accounts` and the live preview updates in real time.
- [ ] "Export schedule (CSV)" downloads a correctly formatted CSV of the next 365 days.
- [ ] "Send a brief" creates a `business_enquiries` row (links to the admin Enquiries screen).
- [ ] Mobile sidebar overlay opens/closes correctly.
- [ ] All colour palette, typography, and component styles match the source HTML reference.

---

## Future improvements
- Real-time collaboration (two HR admins editing simultaneously — Supabase Realtime).
- Slack / Teams integration for approval workflow.
- Direct API connection to popular HRIS tools (BambooHR, Workday, Sage HR for Nigeria).
- Automated order creation when a campaign is approved (instead of manual Retool step).
- Staff self-service portal (staff can update their own delivery address for birthday gifts).
- Multi-office/location support per campaign.
