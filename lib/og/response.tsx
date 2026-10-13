import type { ReactElement } from "react";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

export const OG_CACHE = {
  wishlist: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  pool: "public, max-age=900, s-maxage=3600",
  // Outages and missing fonts should recover quickly instead of sitting in
  // the CDN for a day.
  transientFailure: "public, max-age=60, s-maxage=60",
};

export type OgFallbackReason = "invalid_token" | "not_found" | "private" | "db_error" | "font_missing";

type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
};

async function fetchAsset(path: string, requestUrl: string) {
  const response = await fetch(new URL(path, requestUrl));

  if (!response.ok) {
    throw new Error(`Could not load ${path} (${response.status}).`);
  }

  return response.arrayBuffer();
}

// The fonts are served from /public so the edge function never depends on an
// external font CDN while rendering.
export async function loadOgFonts(requestUrl: string): Promise<OgFont[]> {
  const [regular, bold] = await Promise.all([
    fetchAsset("/fonts/Inter-Regular.ttf", requestUrl),
    fetchAsset("/fonts/Inter-Bold.ttf", requestUrl),
  ]);

  return [
    { name: "Inter", data: regular, weight: 400, style: "normal" },
    { name: "Inter", data: bold, weight: 700, style: "normal" },
  ];
}

/** Renders fully before responding so render and font errors can be caught. */
export async function renderOgImage(
  element: ReactElement,
  fonts: OgFont[],
  cacheControl: string,
) {
  const png = await new ImageResponse(element, { ...OG_SIZE, fonts }).arrayBuffer();

  return new Response(png, {
    status: 200,
    headers: { "Content-Type": "image/png", "Cache-Control": cacheControl },
  });
}

/** Serves the static brand image in place of a personalised one. */
export async function defaultOgImageResponse(
  requestUrl: string,
  { status = 200, cacheControl }: { status?: number; cacheControl: string },
) {
  try {
    const image = await fetchAsset("/og-default.jpg", requestUrl);

    return new Response(image, {
      status,
      headers: { "Content-Type": "image/jpeg", "Cache-Control": cacheControl },
    });
  } catch {
    return Response.redirect(new URL("/og-default.jpg", requestUrl), 302);
  }
}

const ICON_PROPS = {
  fill: "none",
  stroke: "#C50404",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Gift box illustration (lucide "gift"), used where the spec shows 🎁. */
export function GiftIllustration({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...ICON_PROPS}>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
    </svg>
  );
}

/** Party popper (lucide "party-popper"), used where the spec shows 🎉. */
export function PartyIllustration({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...ICON_PROPS} stroke={color} strokeWidth={2}>
      <path d="M5.8 11.3 2 22l10.7-3.79" />
      <path d="M4 3h.01" />
      <path d="M22 8h.01" />
      <path d="M15 2h.01" />
      <path d="M22 20h.01" />
      <path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10" />
      <path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17" />
      <path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7" />
      <path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z" />
    </svg>
  );
}
