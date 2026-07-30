# Feature: Wishlist Visibility & Sharing

> **Status note (2026-07-30):** This feature is shipped, under the name "sharing and giver flow" (`gifvtme_migration_006_sharing_giver_flow.sql`). Per [[feedback-spec-vs-architecture-precedence]], the shipped design diverges from this spec's original proposal in several deliberate ways (no `share_token` column, hex invite tokens not UUID, email-or-phone invites not email-only, WhatsApp share not Web Share API). This file has been corrected to match `app/api/wishlists/[id]/invites/*`, `components/wishlist/ShareSettingsSheet.tsx`, `lib/wishlist/shared.ts`, and `context/architecture/API_ROUTES.md`, which are the source of truth. Treat this as documentation of shipped behavior, not a build target. One real gap closed in this pass: signup-time `invitee_user_id` backfill (`gifvtme_migration_012_invite_backfill_on_signup.sql`) — previously only invite-accept/opt-in-time backfill existed.

## Overview
Controls who can see a wishlist and how. Three visibility tiers: `private` (owner only), `friends_family` (specific invited people), `public` (anyone with the link). A single `prices_visible` toggle controls whether item prices show to non-owners. Sharing uses token-based URLs — givers click a link, they see the wishlist. Invites by email **or phone** create `wishlist_invites` rows. The sharing model is deliberately simple: no item-level visibility, no per-person price settings.

---

## Goals
- Let receivers control exactly who can see their list.
- Make sharing as simple as copying a link.
- Support email (and phone) invitations for the friends-and-family tier.
- Provide a clear record of who's been invited.

---

## User Stories
- As a receiver, I can set my wishlist to private, friends-and-family only, or public.
- As a receiver, I can toggle whether prices show to people viewing my list.
- As a receiver, I can copy a shareable link to send to anyone (public/friends_family only — see UI Requirements).
- As a receiver, I can invite specific people by email or phone so they get access without needing the link.
- As a receiver, I can see who I've invited and remove an invite at any time.
- As a guest with an invite, I see the wishlist after clicking the link, whether or not I have an account.

---

## Functional Requirements
1. `wishlists.visibility` enum: `private` | `friends_family` | `public`. Default `private`.
2. `wishlists.prices_visible` boolean. Default `true`.
3. Shareable link format: `https://gifvtme.com/w/<key>`, where `<key>` is either a `wishlist_invites.token` (friends_family) **or the wishlist's own `id`** (public). There is no separate `share_token` column — the wishlist `id` doubles as its own public share key.
4. For `public` wishlists: the share URL is `/w/<wishlist_id>`, resolved by `gifvtme_get_shared_wishlist()` falling back to an `id` match when no invite token matches (see Backend Logic).
5. For `friends_family`: each invite creates a `wishlist_invites` row with a unique **text token** (`encode(gen_random_bytes(16), 'hex')`, not a UUID). The shareable link uses this token. The invitee is identified by `invitee_email` or `invitee_phone`, with `invitee_user_id` backfilled once matched to an account.
6. Invite by email: the system sends an invitation email via Resend with the wishlist link. Invite by phone: no automated delivery — the owner shares the link manually (e.g. via the WhatsApp button in the sharing panel). Either way, if they don't have an account, they can view (read-only) without signing up — purchasing still requires auth.
7. `invitee_user_id` is backfilled in three ways, not one trigger: (a) on-demand when the invitee accepts/opts in (`gifvtme_accept_wishlist_invite`, `gifvtme_opt_in_wishlist_invite`), (b) at signup time via `gifvtme_backfill_invitee_on_signup_trigger` (migration 012, standalone trigger on `auth.users` — added this pass), and (c) automatically the first time an authenticated user views a friends_family link with a still-unmatched invite (`autoAcceptInvite` in `lib/wishlist/shared.ts`, fires regardless of email match).
8. Removing an invite: deletes the `wishlist_invites` row (`DELETE /api/wishlists/[id]/invites/[inviteId]`). The link using that token immediately stops working. Any associated `reminders` rows are expected to be removed via a DB-level `ON DELETE CASCADE` on `reminders.invite_id` — this FK is presumed to live in the uncommitted migration 001 (see Database Changes); there is no explicit app-level `DELETE FROM reminders` call.
9. Changing visibility from `friends_family` to `private` does not delete existing invites — it just means the `friends_family` RLS policy (via `gifvtme_can_read_wishlist`) no longer grants access until visibility is returned to `friends_family`.
10. A wishlist invite token is a 32-character hex string (128 bits from `gen_random_bytes(16)`) — not guessable. Public wishlist links have no separate token; they use the wishlist's own UUID `id`, gated by `visibility <> 'private'` in `gifvtme_get_shared_wishlist()`.

---

## Non-Functional Requirements
- Share link copy: uses `CopyLinkButton` (clipboard) plus a WhatsApp deep-link share button — not the Web Share API.
- Invite email delivery: fire-and-forget via Resend's REST API with an 8s timeout; invite creation succeeds even if the email send fails (`{ sent: false }`, logged, not surfaced as an error to the owner).

---

## UI Requirements

### Sharing panel (as shipped: `components/wishlist/ShareSettingsSheet.tsx`)
A single `Sheet` component (bottom sheet on mobile, centered dialog on desktop via Tailwind breakpoint classes — the repo's "one responsive component" convention, not a separate Dialog). Triggered from `WishlistCard`, `WishlistItemList`, and `OccasionDetailClient`.

**Section 1: Visibility**
Three-option list (icon + label + subtext), not radio buttons: Private / Friends & Family / Public. Selecting an option calls `PATCH /api/wishlists/[id]` immediately (optimistic update, reverts on failure with a toast). **No "soft warning" copy is shown when switching to Public** — this described interaction was never built.

**Section 2: Price visibility**
Toggle: "Show prices?" / "Show prices to viewers" — on by default, same `PATCH` pattern.

**Section 3: Invite people** (only rendered when `visibility === 'friends_family'` — not "or has existing invites"; switching away from friends_family hides the invite list in the UI even though the rows still exist in the DB)
- Single **"Email address or phone number"** input (not two fields) — the client detects which by checking for `@`, then submits `{ invitee_email }` or `{ invitee_phone }` accordingly.
- List of current invites: initials avatar, email/phone as the label, a green/gray dot + "Accepted"/"Pending" status (accepted = `invitee_user_id` set or `accepted_at` set), remove button (trash icon).
- Empty state: "No one invited yet."

**Section 4: Share link**
- Read-only display of the computed URL (truncated in the middle if long), **not an editable input**.
- `CopyLinkButton` + a WhatsApp share button (`wa.me` deep link with a pre-filled message).
- **Private wishlists show no link at all** — `shareUrl` is empty string when `visibility === 'private'`. This differs from the spec's original "link is always generated and visible, even for private" requirement; current behavior only surfaces a link for public/friends_family.
- For `friends_family`, the link shown is the **first invite's token URL** — there is no link to show until at least one person has been invited (copy: "Invite someone to generate their private link.").

---

## Backend Logic

### Update visibility / prices_visible
`PATCH /api/wishlists/[id]` (`app/api/wishlists/[id]/route.ts`): owner-only (`assertWishlistOwner`), validates via `wishlistUpdateSchema` (partial `{ title?, visibility?, prices_visible? }`, at least one field required), then a scoped Supabase update. Returns `{ wishlist }` with `id, title, type, visibility, prices_visible`.

### Public share resolution — no share_token generation step
Public wishlists never mint a separate token. `gifvtme_get_shared_wishlist(p_share_key)` (SQL function, migration 006) tries an invite-token match first; if none matches and `p_share_key` is UUID-shaped, it falls back to `wishlists.id = p_share_key AND (visibility = 'public' OR wishlist.user_id = auth.uid())`. There is nothing to "generate" — the link is available the moment a wishlist is public.

### Create invite (`POST /api/wishlists/[id]/invites`)
As implemented:
```
1. Validate body via inviteWishlistViewerSchema — invitee_email (lower-cased) OR invitee_phone
   (Nigerian format: /^(\+234|0)[789][01]\d{8}$/), at least one required.
2. Reject self-invite: email/phone matching the owner's own auth email/phone → 400.
3. App-level duplicate pre-check: existing wishlist_invites row for this wishlist_id +
   invitee_email (or invitee_phone) → 409 "You've already invited this person".
4. INSERT into wishlist_invites (wishlist_id, inviter_user_id, invitee_email, invitee_phone,
   reminder_opted_in: false). token is DB-generated (column default), not app-supplied.
5. DB-level unique index catch (23505) → also 409, same message — the pre-check is the fast
   path, the unique index (per wishlist_id + lower(invitee_email), or + invitee_phone) is the
   race-safe guarantee.
6. If invitee_email was provided: send via Resend (sendWishlistInviteEmail), fire-and-forget,
   using buildWishlistShareUrl(invite.token). Phone invites are NOT emailed or SMS'd — the
   owner shares the link manually.
7. Return 201 { invite }.
```

### Remove invite (`DELETE /api/wishlists/[id]/invites/[inviteId]`)
Owner-scoped delete (`.eq("id", inviteId).eq("wishlist_id", id)`). No explicit reminders cleanup in application code — relying on a DB-level cascade presumed to exist from the uncommitted migration 001.

### Backfill invitee_user_id
No longer a single mechanism — see Functional Requirement 7. The `handle_new_user` trigger itself was **not modified** (its live body isn't in this repo — migration 001 was applied directly to Supabase and never committed); instead, migration 012 adds a second, independent `AFTER INSERT ON auth.users` trigger (`gifvtme_backfill_invitee_on_signup_trigger` → `gifvtme_backfill_invitee_on_signup()`) that runs alongside whatever `handle_new_user` already does, matching on lower-cased email.

### Shared wishlist URL resolution (`app/w/[id]/page.tsx` → `getSharedWishlist()`)
```
1. Call gifvtme_get_shared_wishlist(p_share_key) — a single SECURITY DEFINER RPC, not two
   sequential app-level queries as originally proposed. It internally does the
   token-match-then-id-fallback logic described above and returns the wishlist + items + invite
   as one jsonb payload (avoids N+1 round trips and keeps the resolution logic in one place
   under RLS).
2. If an invite was matched and it has no invitee_user_id yet, and the viewer is authenticated:
   auto-accept it (gifvtme_accept_wishlist_invite) — happens on every view, not just on an
   explicit "opt-in" action. This means simply visiting a friends_family link while logged in
   silently claims that invite for your account, regardless of whether your email matches.
3. If nothing resolves: page calls notFound() → Next.js 404. There is no distinct
   "this wishlist is private" page as edge case 1 in the original spec proposed — the RPC's
   WHERE visibility <> 'private' filter makes a private-wishlist link behave identically to an
   invalid one.
```

---

## Database Changes

**No `share_token` column exists or is planned** — superseded by the id-as-share-key design above.

**`wishlist_invites` columns** (added incrementally by migration 006, not a single migration 001 table — see note below):
`id, wishlist_id, inviter_user_id, invitee_email, invitee_phone, invitee_user_id, token (text, default encode(gen_random_bytes(16),'hex')), reminder_opted_in (bool, default false), accepted_at, created_at`. Unique indexes: `token`; `(wishlist_id, lower(invitee_email))` where not null; `(wishlist_id, invitee_phone)` where not null; `(wishlist_id, invitee_user_id)` where not null.

**Note on migration 001:** `context/architecture/FOLDER_STRUCTURE.md` and `DATABASE_SCHEMA.md` reference `gifvtme_migration.sql` (core schema, including the base `wishlists`/`wishlist_invites`/`reminders` tables and the `handle_new_user` trigger) as already applied to the live Supabase project — but that file was never committed to this repo (confirmed via full git history search). Its exact contents, including whether `reminders.invite_id` actually has `ON DELETE CASCADE`, can't be verified from the repo alone.

**Migration 012** (`gifvtme_migration_012_invite_backfill_on_signup.sql`, added this pass): adds `gifvtme_backfill_invitee_on_signup()` + a trigger on `auth.users` for signup-time backfill. **Not yet applied to the live Supabase project** — same "written but unapplied" state as prior migrations flagged in `ROADMAP.md`.

---

## API Endpoints

Fully documented in `context/architecture/API_ROUTES.md` — this section just cross-references, since duplicating the contract here would drift:
- `PATCH /api/wishlists/[id]` — update visibility/prices_visible/title.
- `GET, POST /api/wishlists/[id]/invites` — list invites; create an email-or-phone invite.
- `DELETE /api/wishlists/[id]/invites/[inviteId]` — revoke an invite.
- `POST /api/wishlists/[id]/invites/[inviteId]/opt-in` — invitee opts into Flow 2 reminders.
- `POST /api/wishlists/[id]/reminders/opt-in` — public-wishlist viewer reminder opt-in (creates a `wishlist_invites` row on demand for the authenticated viewer, per the `gifvtme_wishlist_invites_public_self_insert` RLS policy).

**No `GET /api/wishlists/[id]/share-link` endpoint exists** — the spec's originally proposed endpoint was never built. The share URL is computed client-side in `ShareSettingsSheet` from `visibility` + (for friends_family) the first invite's token.

---

## Permissions and Authorization

**RLS policies on `wishlists` (SELECT)** — implemented via a SECURITY DEFINER helper, not a raw RLS expression:
```sql
CREATE POLICY "gifvtme_wishlists_select_viewable" ON public.wishlists
FOR SELECT TO anon, authenticated
USING (public.gifvtme_can_read_wishlist(id, user_id, visibility::text));
```
`gifvtme_can_read_wishlist` covers: owner, `visibility = 'public'`, or an `EXISTS` match against `wishlist_invites` on `invitee_user_id` or lower-cased `invitee_email`. Wrapped in a helper function rather than inlined (per migration 004) specifically to avoid RLS subqueries needing direct read access to `public.users`.

**RLS policies on `wishlist_invites`:**
- Owner: SELECT/INSERT/DELETE for their own wishlists' invites (`gifvtme_is_wishlist_owner`).
- Invitee: SELECT their own invite (by `invitee_user_id` or lower-cased email match).
- **Additional policy not in the original spec:** `gifvtme_wishlist_invites_public_self_insert` — lets an authenticated user insert their own invite row (`invitee_user_id = auth.uid()`) against a wishlist that is `visibility = 'public'`. This is what backs the public-wishlist reminder opt-in flow, letting a public viewer create their own tracked invite without the owner having sent one.

---

## Validation

```typescript
// lib/wishlist/validation.ts — as shipped
export const wishlistUpdateSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  visibility: z.enum(['private', 'friends_family', 'public']).optional(),
  prices_visible: z.boolean().optional(),
}).refine((v) => v.title !== undefined || v.visibility !== undefined || v.prices_visible !== undefined,
  { message: "Provide something to update" });

export const inviteWishlistViewerSchema = z.object({
  invitee_email: /* lower-cased, optional, email format */,
  invitee_phone: /* optional, /^(\+234|0)[789][01]\d{8}$/ — Nigerian format only */,
}).refine((v) => Boolean(v.invitee_email || v.invitee_phone),
  { message: "Enter an email or phone number" });
```

---

## Error Handling

| Error | User-facing message |
|---|---|
| Self-invite attempt | "You can't invite yourself to your own wishlist" (400) |
| Invite already exists (app pre-check or DB unique-index race) | "You've already invited this person" (409) |
| Invite email send fails | Invite still saved (`{ sent: false }` returned internally, logged) — no error shown to the owner; this is a deliberate soft-fail, not yet a surfaced warning as the original spec's error table suggested |
| Remove invite fails | "Couldn't remove invite." |
| Clipboard copy fails | Handled inside `CopyLinkButton` (not documented here — see that component) |

---

## Loading and Empty States

- **Invite list loading:** "Loading invites..." text (not skeleton rows).
- **No invites:** "No one invited yet."
- **Copying link:** handled by `CopyLinkButton`'s own feedback state.

---

## Edge Cases

1. **Receiver shares a `private` wishlist link.** No link is ever shown/generated for private wishlists in the UI. If an old link is visited anyway, `gifvtme_get_shared_wishlist`'s `visibility <> 'private'` filter (for the id-fallback path) means it resolves to nothing → plain 404, not a distinct "this wishlist is private" page as originally proposed.

2. **Invited person's email doesn't match any account.** They can still view `friends_family` wishlists via the token. If they're logged in under any account when they view it, `autoAcceptInvite` claims the invite for that account regardless of email match — a broader behavior than the spec's original "token access without requiring invitee_user_id" framing.

3. **Changing to `private` while givers are actively viewing.** Unchanged from original spec's expectation — RLS blocks on next query, no real-time kick-out.

4. **Removing an invite while the invitee is mid-purchase.** Unchanged from original spec's expectation.

5. **Duplicate invite by the same receiver for the same contact.** Covered by both the app-level pre-check and the DB unique indexes (email lower-cased, phone, and user_id, each scoped per wishlist) — "You've already invited this person".

6. **Public wishlist "share token."** Doesn't apply — there's no `share_token` to lazily generate. The public link is available immediately and always resolves to the current wishlist `id`.

---

## Analytics / Events
Implemented via `trackEvent` in `ShareSettingsSheet`: `wishlist.share_settings.opened`, `wishlist.visibility.changed` (from, to), `wishlist.prices_visible.toggled` (now_visible), `wishlist.invite.sent` (method: email | phone), `wishlist.invite.revoked`. Note: event names/payloads differ slightly from the original spec's proposed list (`wishlist.invite.removed` → `wishlist.invite.revoked`; no separate `wishlist.link.copied` event — that's inside `CopyLinkButton` if tracked at all).

---

## Testing Requirements

### Integration tests
- Changing visibility correctly affects RLS access (verify from a second test user session).
- Invite creates a `wishlist_invites` row; email invites attempt Resend send (mock in tests), phone invites do not.
- Token URL resolution via `gifvtme_get_shared_wishlist`: valid token → correct wishlist; valid public wishlist id → resolves; invalid/private → resolves to nothing.
- Removing an invite: verify the token stops granting access (reminder-cascade behavior can't be verified from this repo alone — depends on the uncommitted migration 001 FK).
- Signup-time backfill: **new** — `gifvtme_backfill_invitee_on_signup_trigger` sets `invitee_user_id` on any matching pending invite when a new `auth.users` row is inserted with a matching lower-cased email. (Added this pass; not yet covered by an automated test — this repo's Supabase-trigger tests would need a live/test Supabase instance, which isn't available in this environment.)

### Manual QA
- Set wishlist to public, copy link, open in incognito — verify visible.
- Set wishlist to friends_family, invite by email and by phone, verify both show up in the invite list with correct pending/accepted state.
- Send an email invite, click the link in the email, verify the wishlist loads and (if logged in) the invite auto-accepts.
- Remove an invite and verify the token link no longer grants access.
- Sign up with an email that has a pending invite; verify `invitee_user_id` gets backfilled (requires migration 012 applied to Supabase).

---

## Acceptance Criteria
- [x] Visibility changes take effect immediately and are enforced by RLS (`gifvtme_can_read_wishlist`), not UI-hiding alone.
- [x] A public wishlist link (`/w/<wishlist_id>`) works for unauthenticated users.
- [x] A friends_family token link gives access to the invite holder regardless of login status (read-only; purchase requires login).
- [x] An invite sends an email with the correct wishlist link (email invites only; phone invites are share-manually).
- [x] Removing an invite immediately invalidates the corresponding token for new access checks.
- [x] `invitee_user_id` is backfilled: on invite-accept, on Flow 2 opt-in, and (as of migration 012, this pass) at signup time. **Not yet applied to Supabase — pending, like migration 011 before it.**

---

## Future Improvements
- Confirm migration 006 and migration 012 are applied to the live Supabase project (currently unconfirmed/pending — see `ROADMAP.md`).
- A distinct "this wishlist is private" page for edge case 1, instead of a generic 404.
- Surfacing invite-email-send failures to the owner instead of only logging them.
- Per-invite access control (view only vs can-contribute money — group gifting, v2 — explicitly out of v1 scope per `AGENTS.md`).
- Invite by phone number **SMS delivery** (currently phone invites have no automated delivery at all — link must be shared manually).
