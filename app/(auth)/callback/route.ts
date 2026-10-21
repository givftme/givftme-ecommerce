import { type NextRequest, NextResponse } from "next/server";
import { OAUTH_CALLBACK_PARAM, OAUTH_CALLBACK_VALUE, getSafeRedirect } from "@/lib/auth/redirect";
import { BUSINESS_HOME, postSignInDestination } from "@/lib/auth/destination";
import { BUSINESS_SIGN_IN_HREF } from "@/lib/business/entry";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Why the sign-in didn't complete, as the login screens' `error` codes.
 * GoogleOAuthButton marks its callback, so a failed or cancelled Google
 * sign-in isn't reported as a dead email link. Supabase passes the
 * provider's `error` through; `access_denied` is the user cancelling.
 */
function failureCode(url: URL) {
  if (url.searchParams.get(OAUTH_CALLBACK_PARAM) !== OAUTH_CALLBACK_VALUE) return "confirmation_failed";
  return url.searchParams.get("error") === "access_denied" ? "oauth_cancelled" : "oauth";
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requested = requestUrl.searchParams.get("redirect");
  const redirectTo = getSafeRedirect(requested);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const destination = await postSignInDestination(supabase, requested);
      return NextResponse.redirect(new URL(destination, requestUrl.origin));
    }
  }

  const failure = failureCode(requestUrl);

  // Business sign-ups confirm back to the dashboard, and its Google button
  // returns there, so a failure goes to the business sign-in screen rather
  // than the consumer login.
  const redirectPath = new URL(redirectTo, requestUrl.origin).pathname;
  if (redirectPath === BUSINESS_HOME || redirectPath.startsWith(`${BUSINESS_HOME}/`)) {
    return NextResponse.redirect(new URL(`${BUSINESS_SIGN_IN_HREF}?error=${failure}`, requestUrl.origin));
  }

  const loginUrl = new URL("/login", requestUrl.origin);
  loginUrl.searchParams.set("error", failure);
  loginUrl.searchParams.set("redirect", redirectTo);

  return NextResponse.redirect(loginUrl);
}
