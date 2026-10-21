import { withRedirect } from "@/lib/auth/redirect";

// Where the public site sends people into the business account system. Safe
// to import from client components (no server-only dependencies).

export type AccountType = "consumer" | "business";

/**
 * Who is looking at a business entry point: decides which CTA they see.
 * `incomplete` is a login whose account type and business membership
 * disagree, so it can't reach the dashboard and isn't a plain personal account.
 */
export type BusinessViewer = "guest" | "consumer" | "business" | "incomplete";

export const BUSINESS_DASHBOARD_HREF = "/business-dashboard";
export const BUSINESS_SIGN_IN_HREF = "/business-dashboard/auth";
/** proxy.ts sends signed-in consumers on to the create-account tab. */
export const BUSINESS_GET_STARTED_HREF = "/get-started?hint=business";
/** The brief form on /business reaches the team. */
export const BUSINESS_CONTACT_HREF = "/business#experience-centre";

export function isBusinessPage(pathname: string) {
  return pathname === "/business" || pathname.startsWith("/business/");
}

/**
 * The dashboard needs both `users.account_type = 'business'` (proxy.ts) and a
 * business_users membership (the page), so only a login with both is a
 * business viewer. `accountType` is null when it couldn't be read.
 */
export function businessViewer({
  signedIn,
  accountType,
  isMember,
}: {
  signedIn: boolean;
  accountType: AccountType | null;
  isMember: boolean;
}): BusinessViewer {
  if (!signedIn) return "guest";
  if (isMember && accountType === "business") return "business";
  if (isMember || accountType === "business") return "incomplete";
  return "consumer";
}

/**
 * The Navbar's sign-in and get-started targets. On the business landing page
 * they lead to the business sign-in screen and the pre-highlighted business
 * card; elsewhere to the consumer login (returning here) and the plain chooser.
 */
export function navbarEntryLinks(pathname: string, search = "") {
  if (isBusinessPage(pathname)) {
    return { signInHref: BUSINESS_SIGN_IN_HREF, getStartedHref: BUSINESS_GET_STARTED_HREF };
  }
  return {
    signInHref: withRedirect("/login", `${pathname}${search ? `?${search}` : ""}`),
    getStartedHref: "/get-started",
  };
}
