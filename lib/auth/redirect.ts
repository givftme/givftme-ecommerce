const DEFAULT_AUTH_REDIRECT = "/wishlists";
const SAFE_REDIRECT_ORIGIN = "https://gifvtme.local";

function hasUnsafeSlashVariant(path: string) {
  let current = path;

  for (let index = 0; index < 3; index += 1) {
    if (current.startsWith("//") || current.includes("\\")) {
      return true;
    }

    try {
      const decoded = decodeURIComponent(current);

      if (decoded === current) {
        return false;
      }

      current = decoded;
    } catch {
      return false;
    }
  }

  return current.startsWith("//") || current.includes("\\");
}

export function getSafeRedirect(
  redirectTo?: string | null,
  fallback = DEFAULT_AUTH_REDIRECT
) {
  if (!redirectTo || !redirectTo.startsWith("/") || hasUnsafeSlashVariant(redirectTo)) {
    return fallback;
  }

  try {
    const url = new URL(redirectTo, SAFE_REDIRECT_ORIGIN);

    if (url.origin !== SAFE_REDIRECT_ORIGIN) {
      return fallback;
    }
  } catch {
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
