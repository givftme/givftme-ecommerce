import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { postSignInDestination } from "@/lib/auth/destination";

const protectedRoutes = [
  "/wishlists",
  "/my-occasions",
  "/dates",
  "/orders",
  "/settings",
  "/checkout",
  "/account",
  "/reviews",
];
const authOnlyRoutes = ["/login", "/signup", "/welcome", "/onboarding"];

function matchesRoute(pathname: string, routes: string[]) {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function redirectWithSessionCookies(
  request: NextRequest,
  response: NextResponse,
  destination: string,
) {
  const redirectResponse = NextResponse.redirect(
    new URL(destination, request.url),
  );

  response.cookies.getAll().forEach((cookie) => {
    const { name, value, ...options } = cookie;
    redirectResponse.cookies.set(name, value, options);
  });

  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { response, supabase, user } = await updateSession(request);

  // Admin routes: a session and a team role. Each admin page still checks its
  // own screen permission; this only keeps customers out of /admin entirely.
  if (matchesRoute(pathname, ["/admin"])) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", `${pathname}${search}`);
      return redirectWithSessionCookies(request, response, loginUrl.pathname + loginUrl.search);
    }

    const { data: role, error } = await supabase.rpc("gifvtme_current_user_admin_role");
    if (error || !role) {
      return redirectWithSessionCookies(request, response, "/?error=unauthorized");
    }
  }

  // Business dashboard: a session whose public.users.account_type is
  // 'business'. The sign-in screen is always reachable; it sends members on
  // to the dashboard itself, and the dashboard page checks business_users
  // membership, so neither can loop through here.
  if (
    matchesRoute(pathname, ["/business-dashboard"]) &&
    !matchesRoute(pathname, ["/business-dashboard/auth"])
  ) {
    if (!user) {
      return redirectWithSessionCookies(request, response, "/business-dashboard/auth");
    }

    let isBusiness = false;
    try {
      const { data: accountType, error } = await supabase.rpc("gifvtme_current_user_account_type");
      isBusiness = !error && accountType === "business";
    } catch {
      // Lookup unavailable: fail closed to the sign-in screen.
    }

    if (!isBusiness) {
      return redirectWithSessionCookies(request, response, "/business-dashboard/auth?error=not_business");
    }
    return response;
  }

  if (matchesRoute(pathname, protectedRoutes) && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", `${pathname}${search}`);

    return redirectWithSessionCookies(
      request,
      response,
      loginUrl.pathname + loginUrl.search,
    );
  }

  if (matchesRoute(pathname, authOnlyRoutes) && user) {
    // An explicit return path wins; otherwise the role's home (or /wishlists).
    const destination = await postSignInDestination(supabase, request.nextUrl.searchParams.get("redirect"));
    // An auth page cannot be the destination for an already signed in user.
    let destinationPath: string;
    try {
      destinationPath = decodeURIComponent(new URL(destination, request.url).pathname);
    } catch {
      destinationPath = "/login";
    }
    return redirectWithSessionCookies(
      request,
      response,
      matchesRoute(destinationPath, authOnlyRoutes) ? await postSignInDestination(supabase, null) : destination,
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
