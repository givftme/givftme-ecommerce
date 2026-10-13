import type { Metadata } from "next";

export const SITE_NAME = "Givftme";
export const TWITTER_HANDLE = "@givftme";

export const DEFAULT_OG_IMAGE = {
  url: "/og-default.jpg",
  width: 1200,
  height: 630,
  alt: "Givftme — Never miss the moments that matter.",
};

export const NO_INDEX: Metadata["robots"] = { index: false, follow: false };

export type OgImage = {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
};

/** Trims text to a meta description length, breaking on a word where possible. */
export function truncateDescription(text: string, maxLength = 155) {
  const clean = text.replace(/\s+/g, " ").trim();

  if (clean.length <= maxLength) {
    return clean;
  }

  const cut = clean.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

type PageMetadataInput = {
  /** Page name only; " — Givftme" is appended. */
  title: string;
  description: string;
  path: string;
  image?: OgImage;
};

// Next replaces nested openGraph and twitter objects per segment instead of
// merging them, so each page emits the full set rather than relying on the
// root layout's values. The title is absolute because the root layout's
// template doesn't reach the home page, which shares the layout's segment.
export function buildPageMetadata({
  title,
  description,
  path,
  image = DEFAULT_OG_IMAGE,
}: PageMetadataInput): Metadata {
  const fullTitle = `${title} — ${SITE_NAME}`;

  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: SITE_NAME,
      type: "website",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      site: TWITTER_HANDLE,
      title: fullTitle,
      description,
      images: [image.url],
    },
  };
}
