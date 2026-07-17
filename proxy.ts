import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const protectedRoutes = [
  "/wishlists",
  "/occasions",
  "/dates",
  "/orders",
  "/settings",
  "/checkout",
  "/account",
];
const authOnlyRoutes = [
  "/login",
  "/signup",
  "/welcome",
  "/onboarding",
];

function matchesRoute(pathname: string, routes: string[]) {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

function redirectWithSessionCookies(
  request: NextRequest,
  response: NextResponse,
  destination: string
) {
  const redirectResponse = NextResponse.redirect(new URL(destination, request.url));

  response.cookies.getAll().forEach((cookie) => {
    const { name, value, ...options } = cookie;
    redirectResponse.cookies.set(name, value, options);
  });

  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { response, user } = await updateSession(request);

  if (matchesRoute(pathname, protectedRoutes) && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", `${pathname}${search}`);

    return redirectWithSessionCookies(request, response, loginUrl.pathname + loginUrl.search);
  }

  if (matchesRoute(pathname, authOnlyRoutes) && user) {
    return redirectWithSessionCookies(request, response, "/wishlists");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
