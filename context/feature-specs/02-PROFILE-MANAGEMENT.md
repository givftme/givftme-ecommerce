# Feature: Profile Management

## Overview
Allows authenticated users to manage their personal information: display name, avatar, phone number, and default thank-you message. The default thank-you message is load-bearing — it powers the automated thank-you message sent to every gift buyer (see `05-thank-you/`). Account deletion also lives here.

---

## Goals
- Let users personalize how they appear to others (name, photo).
- Capture a default thank-you message once so the automated thank-you system always has something meaningful to send.
- Provide a safe account deletion path.

---

## User Stories
- As a user, I can update my display name so people recognize me on shared wishlists.
- As a user, I can upload a profile photo.
- As a user, I can add my phone number for optional SMS features.
- As a user, I can write a default thank-you message once so I don't have to write it every time someone buys me a gift.
- As a user, I can delete my account and all my data permanently.

---

## Functional Requirements
1. Editable fields: `full_name`, `avatar_url` (via upload), `phone`, `default_thank_you_msg`.
2. Avatar upload: stores file in Supabase Storage bucket `avatars`, under path `<user_id>/<filename>`. On upload, the public URL is written to `users.avatar_url`.
3. If `full_name` is null (can happen with Google signup when no name is in metadata), the profile page shows a yellow banner: "Add your name so friends know whose wishlist they're viewing."
4. `default_thank_you_msg` has a textarea with a character counter — max 500 characters. Placeholder shows the system default: "Thank you so much for the gift, I really appreciate you!" so the user knows what fires if they leave it blank.
5. Account deletion: requires user to type "DELETE" into a confirmation input before the action fires. On confirm: call `supabase.auth.admin.deleteUser(id)` from a server action (service role), which cascades via RLS and FK constraints to remove all user data. Show a final warning listing what will be deleted.
6. Sign out button on this page — calls `supabase.auth.signOut()`, redirects to `/`.

---

## Non-Functional Requirements
- Avatar images are served from Supabase Storage CDN — no resize/optimization in v1, but enforce a 5MB upload limit.
- Profile updates are optimistically reflected in the navbar avatar without a full page reload.

---

## UI Requirements

### Route: `/account/profile`

**Layout:** single column form, max-width `2xl`, centered on desktop.

**Sections:**

**1. Avatar**
Circular avatar (80px diameter). Click/tap to trigger file input. Shows current avatar or initials fallback (first letter of `full_name`, on a `brand-light` background). Upload progress indicator while uploading.

**2. Personal info**
- Full name (text input, required)
- Email (read-only, shown for reference — auth email cannot be changed from here in v1)
- Phone (text input, optional, placeholder: "+234 800 000 0000")

**3. Default thank-you message**
Textarea, 4 rows, max 500 chars. Character counter displayed below (`120/500`). Helper text: "This is sent automatically to anyone who buys you a gift."

**4. Actions**
"Save changes" button (filled, full width on mobile, auto width on desktop). Only enabled when form is dirty (has unsaved changes).

**5. Danger zone**
Visually separated section (border-top, heading "Danger zone" in muted text).
- "Sign out" (ghost button, text variant on mobile)
- "Delete account" (danger variant — red text, ghost styling) → opens a shadcn Dialog confirmation

**Delete account dialog:**
- Warning copy listing what's deleted (wishlists, occasions, orders, reviews).
- Text input: type "DELETE" to confirm.
- "Permanently delete my account" button, only enabled when input matches exactly.

---

## Backend Logic

**Save profile:** Direct Supabase client UPDATE on `public.users` where `id = auth.uid()`. RLS enforces user can only update their own row.

**Avatar upload:**
```
1. Validate file type (image/jpeg, image/png, image/webp only) and size (≤5MB).
2. Generate unique filename: `${userId}/${Date.now()}-${sanitizedOriginalName}`.
3. Upload to Supabase Storage bucket 'avatars' with upsert: true.
4. Get public URL from storage.
5. UPDATE public.users SET avatar_url = publicUrl WHERE id = userId.
```

**Account deletion (server action, uses service role):**
```
1. Verify the confirmation input matches "DELETE" exactly (case-sensitive).
2. Call supabase.auth.admin.deleteUser(userId) — cascades to public.users and all FK-linked data due to ON DELETE CASCADE constraints.
3. Sign out the session.
4. Redirect to / with a query param ?deleted=true to show a farewell message.
```

---

## Database Changes
No new tables. Updates `public.users`:
- `phone` — already on the table; verify it exists in migration 001.
- `default_thank_you_msg` — already on the table with default value.
- `avatar_url` — already on the table.

Supabase Storage bucket required: `avatars` (public bucket, since avatars are displayed in shared contexts).

---

## API Endpoints
No custom API routes needed. All operations via Supabase client SDK (RLS-protected updates) or a server action for deletion (which needs service role — use Next.js server action in `app/account/profile/actions.ts`).

---

## Permissions and Authorization
- All reads/writes scoped to `auth.uid() = id` via RLS.
- Avatar bucket: authenticated users can upload to their own folder (`avatars/<uid>/*`), public read for all (avatars display in shared contexts like the wishlist header).
- Account deletion requires service role (the `deleteUser` admin method) — must be a server action, never called from client code.

---

## Validation

```typescript
const profileSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters").max(100),
  phone: z.string().max(20).optional().or(z.literal("")),
  default_thank_you_msg: z.string().max(500).optional(),
})
```

Avatar validation (client-side before upload):
- Allowed types: `image/jpeg`, `image/png`, `image/webp`
- Max size: 5MB (5 * 1024 * 1024 bytes)

---

## Error Handling

| Error | User-facing message |
|---|---|
| Avatar file too large | "Image must be under 5MB." |
| Avatar wrong file type | "Please upload a JPEG, PNG, or WebP image." |
| Avatar upload fails (network) | "Upload failed. Please try again." |
| Profile save fails | "Couldn't save your changes. Please try again." |
| Delete account fails | "Account deletion failed. Please try again or contact support." |

---

## Loading and Empty States

- **Save button:** shows spinner, disabled while submitting.
- **Avatar upload:** shows a loading overlay on the avatar circle while uploading.
- **No avatar set:** renders initials avatar (first letter of `full_name`, or "?" if name is also null) on brand-light background.
- **`default_thank_you_msg` is null/empty:** textarea shows placeholder text of the system default — does not pre-fill the field (so the user knows the field is empty and the system default fires if left so).

---

## Edge Cases

1. **Google signup with no `full_name` in metadata.** Show the "Add your name" banner on first visit. Banner is dismissible (store dismissed state in localStorage — not a DB-level preference, this is minor enough not to need persistence across devices).

2. **User uploads a new avatar while one already exists.** `upsert: true` on the Supabase Storage upload handles this — the old file is overwritten at the same path rather than accumulating old files.

3. **User clears their avatar (wants to go back to initials).** The UI should offer a "Remove photo" option if an avatar exists. On removal: delete the file from storage and set `avatar_url = null`.

4. **`full_name` updated.** Changes must propagate to: the navbar avatar display, the shared wishlist header (receiver's name), and the thank-you message sender name. These all read from `public.users` at render time so they update automatically on next page load — no manual sync needed, but the navbar may need to revalidate via `router.refresh()` after a client-side update.

5. **Account deletion with active pending orders.** The DB cascade will delete the order records, but the internal Retool ops team would lose visibility into an in-flight order. Consider whether account deletion should be blocked while there's an order with status `confirmed`/`under_review`/`forwarded`/`shipped`. **Recommendation: block deletion and show "You have an active order. Please wait for it to be delivered before deleting your account."** Not yet specified in `PRD.md` — flag as a decision.

---

## Analytics / Events
- `profile.updated` — any profile field saved (fields_changed: array of changed field names)
- `profile.avatar_uploaded`
- `profile.avatar_removed`
- `account.deleted`
- `auth.signed_out` (from profile page)

---

## Testing Requirements

### Unit tests
- Zod profile schema: valid and invalid input combinations.
- Avatar validation: correct rejection of oversized files and wrong types.

### Integration tests
- Profile update persists correctly and is immediately readable.
- Avatar upload: file appears in Supabase Storage, URL written to `public.users`.
- Account deletion: user row and all cascade-deleted data is gone after deletion; session is invalidated.

### Manual QA
- Update name, verify it reflects in navbar and on a shared wishlist viewed in another tab.
- Upload an avatar, verify it displays in navbar and on shared wishlists.
- Set a default thank-you message, trigger a purchase, verify the message is used in the automated thank-you.
- Attempt account deletion without typing "DELETE" — confirm button stays disabled.
- Complete account deletion — verify redirect to `/` and inability to log in again.

---

## Acceptance Criteria
- [ ] All four editable fields (name, phone, avatar, default message) save correctly and persist on page reload.
- [ ] Avatar upload works for JPEG/PNG/WebP under 5MB and fails gracefully for other types/sizes.
- [ ] `full_name = null` shows the "Add your name" banner on profile page.
- [ ] Default thank-you message is used in automated thank-you when a purchase is made (integration with `05-THANK-YOU-AUTOMATED.md`).
- [ ] Account deletion requires typing "DELETE" and permanently removes the user's data.
- [ ] After deletion, the user is signed out and cannot sign back in with the same credentials.

---

## Future Improvements
- Allow changing email address (currently read-only).
- Profile visibility settings (show/hide phone to people viewing shared wishlists).
- Social links (Instagram, etc.) for the receiver's profile on their shared wishlists.
