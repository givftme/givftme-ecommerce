const DEFAULT_AUTH_REDIRECT = "/dashboard/wishlists";

export function getSafeRedirect(
  redirectTo?: string | null,
  fallback = DEFAULT_AUTH_REDIRECT
) {
  if (!redirectTo || !redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return fallback;
  }

  return redirectTo;
}

export function withRedirect(path: string, redirectTo?: string | null) {
  const safeRedirect = getSafeRedirect(redirectTo, "");

  if (!safeRedirect) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}redirect=${encodeURIComponent(safeRedirect)}`;
}
