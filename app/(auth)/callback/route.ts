import { type NextRequest, NextResponse } from "next/server";
import { getSafeRedirect } from "@/lib/auth/redirect";
import { postSignInDestination } from "@/lib/auth/destination";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

  const loginUrl = new URL("/login", requestUrl.origin);
  loginUrl.searchParams.set("error", "confirmation_failed");
  loginUrl.searchParams.set("redirect", redirectTo);

  return NextResponse.redirect(loginUrl);
}
