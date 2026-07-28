# Feature: Wishlist Visibility & Sharing

## Overview
Controls who can see a wishlist and how. Three visibility tiers: `private` (owner only), `friends_family` (specific invited people), `public` (anyone with the link). A single `prices_visible` toggle controls whether item prices show to non-owners. Sharing uses token-based URLs — givers click a link, they see the wishlist. Invites by email/phone create `wishlist_invites` rows. The sharing model is deliberately simple: no item-level visibility, no per-person price settings.

---

## Goals
- Let receivers control exactly who can see their list.
- Make sharing as simple as copying a link.
- Support email invitations for the friends-and-family tier.
- Provide a clear record of who's been invited.

---

## User Stories
- As a receiver, I can set my wishlist to private, friends-and-family only, or public.
- As a receiver, I can toggle whether prices show to people viewing my list.
- As a receiver, I can copy a shareable link to send to anyone.
- As a receiver, I can invite specific people by email so they get access without needing the link.
- As a receiver, I can see who I've invited and remove an invite at any time.
- As a guest with an invite, I see the wishlist after clicking the link, whether or not I have an account.

---

## Functional Requirements
1. `wishlists.visibility` enum: `private` | `friends_family` | `public`. Default `private`.
2. `wishlists.prices_visible` boolean. Default `true`.
3. Shareable link format: `https://gifvtme.com/w/<token>` where `token` is the `wishlist_invites.token` (for friends_family) or a direct public token (for public wishlists).
4. For `public` wishlists: a direct share URL using the wishlist `id` or a dedicated `share_token` on the `wishlists` table — see DB changes.
5. For `friends_family`: each invite creates a `wishlist_invites` row with a unique UUID token. The sharable link uses this token. The invitee is identified by `invitee_email` or `invitee_user_id`.
6. Invite by email: the system sends an invitation email via Resend with the wishlist link. The recipient clicks it, lands on the shared wishlist. If they don't have an account, they can view (read-only) without signing up — purchasing still requires auth.
7. When an invited user signs up with the same email they were invited with, the `wishlist_invites.invitee_user_id` is backfilled automatically (via a trigger or login hook).
8. Removing an invite: deletes the `wishlist_invites` row. The link using that token immediately stops working (returns 404/403). Any pending `reminders` tied to that invite (`invite_id`) are deleted.
9. Changing visibility from `friends_family` to `private` does not delete existing invites — it just means the `friends_family` RLS policy no longer grants access until visibility is returned to `friends_family`.
10. A wishlist invite token is a UUID — not guessable. Public wishlist links use a separate `share_token` (also UUID, generated at creation or on first share).

---

## Non-Functional Requirements
- Share link copy must work on mobile via the Web Share API (if supported) falling back to clipboard.
- Invite email delivery should complete within 30 seconds of the invite being created.

---

## UI Requirements

### Sharing panel (bottom sheet on mobile, dialog on desktop)
Triggered by "Share wishlist" CTA on both the dashboard wishlist view and the occasion detail page.

**Section 1: Visibility**
Three-option selector (radio-style with icon+label):
- 🔒 Private — "Only you can see this"
- 👥 Friends & Family — "Only people you invite"
- 🌍 Public — "Anyone with the link"

Public option shows a soft warning: "Anyone who finds this link can view your wishlist." (dismissible, shown once per toggle to public).

**Section 2: Price visibility**
Toggle: "Show prices to viewers" — on by default.

**Section 3: Share link**
- Full URL displayed in a read-only input.
- "Copy link" button (icon + label). On click: shows "Copied!" for 2 seconds.
- On mobile (if Web Share API supported): "Share" button opens native share sheet.
- Link is always generated and visible — even for private wishlists (receiver may share it directly, RLS handles access).

**Section 4: Invited people** (only shown when visibility = `friends_family` or the list has existing invites)
- "Invite someone" form: email input + "Send invite" button.
- List of current invites: avatar/initials, email, joined/pending status, "Remove" button (×).
- Empty state: "No one invited yet. Add people below."

---

## Backend Logic

### Update visibility / prices_visible
Direct Supabase update: `UPDATE wishlists SET visibility=$1, prices_visible=$2 WHERE id=$id AND user_id=auth.uid()`.

### Generate public share token
On first share of a public wishlist (or if `share_token` is null):
```sql
UPDATE wishlists SET share_token = gen_random_uuid() WHERE id=$1 AND share_token IS NULL;
```
The share link for public wishlists: `/w/<share_token>`.

### Create invite
```
1. Check invitee_email is not already invited to this wishlist.
2. INSERT INTO wishlist_invites (wishlist_id, invitee_email, token=gen_random_uuid(), invited_by=auth.uid()).
3. Look up whether a user exists with that email: SELECT id FROM auth.users WHERE email=$email.
4. If exists: also set invitee_user_id.
5. Send invite email via Resend: subject "You've been invited to view [receiver_name]'s wishlist", body includes the /w/<token> link.
```

### Backfill invitee_user_id on signup
In the `handle_new_user` trigger (extend existing):
```sql
UPDATE wishlist_invites SET invitee_user_id = NEW.id WHERE invitee_email = NEW.email AND invitee_user_id IS NULL;
```

### Remove invite
```
1. DELETE FROM reminders WHERE invite_id=$inviteId AND sent=false.
2. DELETE FROM wishlist_invites WHERE id=$inviteId AND wishlist_id IN (SELECT id FROM wishlists WHERE user_id=auth.uid()).
```

### Shared wishlist URL resolution (in `app/w/[id]/page.tsx`)
```
1. Try: SELECT * FROM wishlist_invites WHERE token=$id → get wishlist_id.
2. If found: check invitee_user_id or invitee_email matches current user (if logged in) OR wishlist.visibility = 'friends_family' (any token holder can view).
3. If not found: try SELECT * FROM wishlists WHERE share_token=$id AND visibility='public'.
4. If neither: 404.
```

---

## Database Changes

**Add `share_token` to `wishlists`:**
```sql
ALTER TABLE wishlists ADD COLUMN IF NOT EXISTS share_token UUID UNIQUE DEFAULT NULL;
CREATE INDEX IF NOT EXISTS wishlists_share_token_idx ON wishlists(share_token) WHERE share_token IS NOT NULL;
```

**`wishlist_invites` table** (should exist from migration 001 — verify):
```
id, wishlist_id, invitee_email, invitee_user_id (nullable), invited_by, token (UUID unique), reminder_opted_in (bool default false), created_at
```

---

## API Endpoints

### `PATCH /api/wishlists/[id]`
Update visibility and/or prices_visible.
**Auth:** required (owner only).
**Body:** `{ visibility?: Visibility, prices_visible?: boolean }`
**Response:** `{ wishlist: Wishlist }`.

### `POST /api/wishlists/[id]/invites`
Send an invite.
**Auth:** required (owner only).
**Body:** `{ email: string }`
**Response:** `{ invite: WishlistInvite }`.

### `DELETE /api/wishlists/[id]/invites/[inviteId]`
Remove an invite.
**Auth:** required (owner only).
**Response:** `{ deleted: true }`.

### `GET /api/wishlists/[id]/share-link`
Returns the shareable link (generating `share_token` if needed for public wishlists).
**Auth:** required (owner only).
**Response:** `{ url: string }`.

---

## Permissions and Authorization

**RLS policies on `wishlists` (SELECT):**
```sql
-- Owner always has access
auth.uid() = user_id

-- Public wishlists: anyone (including anon)
visibility = 'public'

-- Friends & family: invited users
EXISTS (
  SELECT 1 FROM wishlist_invites wi
  WHERE wi.wishlist_id = wishlists.id
  AND (wi.invitee_user_id = auth.uid() OR wi.invitee_email = auth.email())
)
```

**RLS policies on `wishlist_invites`:**
- Owner can SELECT/INSERT/DELETE invites for their wishlists.
- Invitee can SELECT their own invite (needed to check `reminder_opted_in`).

---

## Validation

```typescript
const updateVisibilitySchema = z.object({
  visibility: z.enum(['private', 'friends_family', 'public']).optional(),
  prices_visible: z.boolean().optional(),
})

const inviteSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
})
```

---

## Error Handling

| Error | User-facing message |
|---|---|
| Invite already exists | "This person is already invited." |
| Invite email send fails | "Invite saved, but we couldn't send the email. Share the link manually." (save invite, flag email failure) |
| Remove invite fails | "Couldn't remove this invite. Please try again." |
| Clipboard copy fails | Show the URL in a modal so they can copy manually |

---

## Loading and Empty States

- **Invite list loading:** skeleton rows.
- **No invites:** "No one invited yet." with the invite form below.
- **Copying link:** brief "Copied!" feedback, then reverts to "Copy link".

---

## Edge Cases

1. **Receiver shares a `private` wishlist link.** The link resolves — but RLS blocks the query (private = owner only). Viewer sees a "This wishlist is private" page, not a 404, so the receiver knows the link technically works but is currently private.

2. **Invited person's email doesn't match any account.** They can still view `friends_family` wishlists via the token — the `wishlist_invites` policy covers token-based access without requiring `invitee_user_id` to be set. Purchasing still requires signup.

3. **Changing to `private` while givers are actively viewing the wishlist.** Their current page session continues (they have it loaded). But on next refresh, RLS blocks them. No real-time kick-out needed.

4. **Removing an invite while the invitee is mid-purchase.** The link stops working, but if they're on the purchase confirmation screen (`/w/[id]/confirm/[itemId]`), the confirm POST should still work — the purchase action doesn't need re-resolving the wishlist token.

5. **Duplicate invite by the same receiver for the same email.** DB unique constraint on `(wishlist_id, invitee_email)`. Application code should catch and surface the friendly error: "This person is already invited."

6. **Public wishlist has no `share_token` yet** (wishlist created before this feature shipped). `share_token` is null. On first "Copy link" click, generate and persist it. Show the spinner briefly.

---

## Analytics / Events
- `wishlist.visibility.changed` (from, to)
- `wishlist.prices_visible.toggled` (new_value)
- `wishlist.invite.sent`
- `wishlist.invite.removed`
- `wishlist.link.copied`

---

## Testing Requirements

### Integration tests
- Changing visibility correctly affects RLS access (verify from a second test user session).
- Invite creates a `wishlist_invites` row and sends email (mock Resend in tests).
- Token URL resolution: valid token → correct wishlist; invalid token → 404.
- Removing an invite deletes associated unsent reminders.
- `handle_new_user` trigger backfills `invitee_user_id` for pending invites matching the new user's email.

### Manual QA
- Set wishlist to public, copy link, open in incognito — verify visible.
- Set wishlist to friends_family, copy link, open in incognito — verify access blocked without valid invite token.
- Send invite to a real email, click the link in the email, verify wishlist loads.
- Remove an invite and verify the token link returns an appropriate denied page.

---

## Acceptance Criteria
- [ ] Visibility changes take effect immediately and are enforced by RLS, not UI-hiding alone.
- [ ] A public wishlist link works for unauthenticated users.
- [ ] A friends_family token link gives access to the invite holder regardless of login status (read-only; purchase requires login).
- [ ] An invite sends an email with the correct wishlist link.
- [ ] Removing an invite immediately invalidates the corresponding token.
- [ ] `invitee_user_id` is backfilled when an invited email address signs up.

---

## Future Improvements
- Invite by phone number (SMS delivery via a Nigerian SMS gateway).
- Bulk invite (paste multiple emails at once).
- Per-invite access control (view only vs can-contribute money — group gifting, v2).
- QR code for share link.
