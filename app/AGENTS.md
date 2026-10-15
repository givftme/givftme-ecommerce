# Application routes

## Overview

This directory contains App Router pages, layouts, server actions, and API handlers. You can use the root AGENTS.md for product boundaries and inspect existing routes for current behavior.

## Key files

| File | Owns |
|---|---|
| `layout.tsx` | Root document and font setup |
| `(dashboard)/layout.tsx` | Receiver authentication, evergreen wishlist setup, and toast provider |
| `w/layout.tsx` | Shared wishlist toast provider |
| `../proxy.ts` | Session refresh and selected page redirects |
| `../components/layout/PageWrapper.tsx` | Server data for the public page shell |
| `../components/layout/PublicPageShell.tsx` | Cart provider, toast provider, and public navigation |

## Conventions

You can place receiver pages in `(dashboard)`, shared giver pages in `w/[id]`, and buyer order pages in `account/orders`. Route groups do not add URL segments, so `(dashboard)/dates/page.tsx` serves `/dates`.

You can reuse `PageWrapper` for public catalog pages. The root layout does not provide cart or toast context. Before using a context hook, check the page shell that actually wraps the component.

Pages default to server components. Existing dynamic pages and API handlers await their promise based route parameters. You can consult the installed Next.js guides named by root AGENTS.md before changing these conventions.

`_components/` is a private folder (no route) holding the home page sections and their helpers.

Admin pages live in `admin/`. `admin/layout.tsx` requires a team role (`requireTeamMember()`) and renders `AdminShell`; each dashboard page then calls `requireAdminScreen(screen, { path })` from `lib/admin/auth.ts`, which redirects roles outside the matrix in `lib/admin/roles.ts` and logs the view to `admin_actions`. Pages read with the service client through `lib/admin/data/*`. After sign-in (password login, the `/callback` route, and the proxy's auth-page redirect), `postSignInDestination()` in `lib/auth/destination.ts` decides where to go: an explicit safe `redirect` wins, otherwise team members land on `homePathForRole()` (`ROLE_HOME_SCREEN` in `lib/admin/roles.ts`) and customers on `/wishlists`. The older `admin/gift-candidates` and `admin/pricing` pages still authorize with `requireAdminPageUser()` against `ADMIN_EMAILS`, and now also need a role to pass the proxy.

The business dashboard lives at `business-dashboard/`: `page.tsx` loads every view's data on the server and renders `BizDashShell`, and `auth/page.tsx` is the sign-in / create-account screen. `proxy.ts` sends sessions whose `users.account_type` isn't `business` (checked through `gifvtme_current_user_account_type()`) to the auth screen and never redirects away from it; the page itself checks `business_users` membership. `postSignInDestination()` sends business accounts to `/business-dashboard`.

## Gotchas

The dashboard layout authenticates the viewer and ensures an evergreen wishlist exists. The shared wishlist layout only provides toast context. A layout or proxy redirect does not replace authorization inside a route handler.

## Related context

See [project context](../AGENTS.md) and [API context](api/AGENTS.md).

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._

Account routes share `account/layout.tsx`, which authenticates the viewer and installs `PageWrapper` and `AccountShell`. Nested Account pages provide content only, while data reads and mutations retain their own ownership checks.
