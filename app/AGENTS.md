# Application routes

## Overview

This directory contains App Router pages, layouts, server actions, and API handlers. You can use the root AGENTS.md and existing feature specifications for product rules.

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

## Gotchas

The dashboard layout authenticates the viewer and ensures an evergreen wishlist exists. The shared wishlist layout only provides toast context. A layout or proxy redirect does not replace authorization inside a route handler.

## Related specs

See [feature specifications](../context/feature-specs/) and [API context](api/AGENTS.md).

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
