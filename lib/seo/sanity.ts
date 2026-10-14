import { urlFor } from "@/sanity/lib/image";
import type { OgImage } from "@/lib/seo/metadata";

/** Builds a 1200×630 crop of a Sanity CDN image for Open Graph previews. */
export function sanityOgImage(
  imageUrl: string | null | undefined,
  alt: string,
): OgImage | undefined {
  if (!imageUrl) {
    return undefined;
  }

  try {
    const url = urlFor(imageUrl).width(1200).height(630).fit("crop").url();
    return { url, width: 1200, height: 630, alt };
  } catch {
    return undefined;
  }
}
