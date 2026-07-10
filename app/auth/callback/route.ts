import { type NextRequest, NextResponse } from "next/server";
import { getSafeRedirect } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirectTo = getSafeRedirect(requestUrl.searchParams.get("redirect"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
    }
  }

  const loginUrl = new URL("/auth/login", requestUrl.origin);
  loginUrl.searchParams.set("error", "confirmation_failed");
  loginUrl.searchParams.set("redirect", redirectTo);

  return NextResponse.redirect(loginUrl);
}
