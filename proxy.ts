import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

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

function getRequestOrigin(request: NextRequest) {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  const protocol = request.headers.get("x-forwarded-proto") ?? "https";

  return `${protocol}://${host}`;
  
}

function redirectWithSessionCookies(
  request: NextRequest,
  response: NextResponse,
  destination: string,
) {
  const origin = getRequestOrigin(request);

  const redirectResponse = NextResponse.redirect(new URL(destination, origin));

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
    const params = new URLSearchParams();

    params.set("redirect", `${pathname}${search}`);

    return redirectWithSessionCookies(
      request,
      response,
      `/login?${params.toString()}`,
    );
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

