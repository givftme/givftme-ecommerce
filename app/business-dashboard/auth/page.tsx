import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BizAuthScreen } from "@/components/business-dashboard/BizAuthScreen";
import { businessViewer } from "@/lib/business/entry";
import { BUSINESS_DASHBOARD_PATH } from "@/lib/business-dashboard/auth";
import { getBusinessSession } from "@/lib/business-dashboard/queries";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  not_business:
    "That login is a personal Givftme account. Business accounts are separate and use a different (work) email.",
  confirmation_failed:
    "That confirmation link has expired or was already used. If you've confirmed already, sign in. Otherwise, send yourself a new link below.",
  oauth: "We couldn't sign you in with Google. Please try again.",
  oauth_cancelled: "Google sign-in was cancelled. Try again, or use your email and password.",
};

export default async function BusinessAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; tab?: string; type?: string }>;
}) {
  const { user, member, accountType } = await getBusinessSession();
  // Only a login proxy.ts also lets through goes on, so this can't loop.
  const viewer = businessViewer({ signedIn: Boolean(user), accountType, isMember: Boolean(member) });
  if (viewer === "business") redirect(BUSINESS_DASHBOARD_PATH);

  const signedIn =
    user && (viewer === "consumer" || viewer === "incomplete")
      ? { email: user.email || "", state: viewer === "incomplete" ? ("incomplete" as const) : ("personal" as const) }
      : null;

  // `type=business` arrives from /get-started, so it opens on Create account.
  const { error, tab, type } = await searchParams;
  // A signed-in login gets its own notice, which says more than not_business.
  const message = error && !(signedIn && error === "not_business") ? ERRORS[error] ?? null : null;

  return (
    <BizAuthScreen
      initialTab={tab === "create" || type === "business" ? "create" : "signin"}
      initialError={message}
      offerResend={error === "confirmation_failed"}
      signedIn={signedIn}
    />
  );
}
