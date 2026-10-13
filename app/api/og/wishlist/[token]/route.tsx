/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */

import { trackEvent } from "@/lib/analytics";
import { getCountdownLabel, isValidWishlistShareKey } from "@/lib/og/format";
import { loadImageAsDataUrl } from "@/lib/og/images";
import {
  defaultOgImageResponse,
  GiftIllustration,
  loadOgFonts,
  OG_CACHE,
  type OgFallbackReason,
  renderOgImage,
} from "@/lib/og/response";
import { getWishlistOgData, type WishlistOgData } from "@/lib/og/wishlist";
import { getInitials } from "@/lib/wishlist/display";

export const runtime = "edge";

const GRID_SIZE = 3;

function fallback(req: Request, reason: OgFallbackReason) {
  trackEvent("og.image.fallback_used", { route: "wishlist", reason });

  const transient = reason === "db_error" || reason === "font_missing";
  return defaultOgImageResponse(req.url, {
    status: reason === "invalid_token" ? 400 : 200,
    cacheControl: transient ? OG_CACHE.transientFailure : OG_CACHE.wishlist,
  });
}

function WishlistImage({
  data,
  avatar,
  images,
  countdownLabel,
}: {
  data: WishlistOgData;
  avatar: string | null;
  images: string[];
  countdownLabel: string | null;
}) {
  const extraCount = data.availableCount >= GRID_SIZE + 1
    ? data.availableCount - images.length
    : 0;
  const heading = `${data.receiverName}'s${data.occasionTitle ? ` ${data.occasionTitle}` : ""} Wishlist`;

  return (
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#FFFFFF",
        fontFamily: "Inter",
      }}
    >
      <div style={{ width: "100%", height: "8px", backgroundColor: "#C50404" }} />

      <div style={{ display: "flex", alignItems: "center", gap: "20px", padding: "40px 60px 32px" }}>
        {avatar ? (
          <img src={avatar} width={80} height={80} style={{ borderRadius: "50%", objectFit: "cover" }} />
        ) : (
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              backgroundColor: "#FEF2F2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
              fontWeight: 700,
              color: "#C50404",
            }}
          >
            {getInitials(data.receiverName)}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: "36px",
              fontWeight: 700,
              color: "#000000",
              lineHeight: 1.1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {heading}
          </span>
          {data.occasionTitle ? (
            <span style={{ fontSize: "22px", fontWeight: 400, color: "#4A4A4A" }}>{data.occasionTitle}</span>
          ) : null}
          {countdownLabel ? (
            <div style={{ display: "flex" }}>
              <span
                style={{
                  backgroundColor: "#FEF2F2",
                  color: "#C50404",
                  padding: "6px 16px",
                  borderRadius: "999px",
                  fontSize: "18px",
                  fontWeight: 700,
                }}
              >
                {countdownLabel}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ display: "flex", gap: "16px", padding: "0 60px", flex: 1, alignItems: "center" }}>
        {images.map((src, index) => (
          <img
            key={index}
            src={src}
            width={180}
            height={180}
            style={{ borderRadius: "12px", objectFit: "cover" }}
          />
        ))}
        {images.length > 0 && extraCount > 0 ? (
          <div
            style={{
              width: 180,
              height: 180,
              borderRadius: "12px",
              backgroundColor: "#F7F7F7",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#4A4A4A",
            }}
          >
            <span style={{ fontSize: "36px", fontWeight: 700 }}>+{extraCount}</span>
            <span style={{ fontSize: "20px", fontWeight: 400 }}>more</span>
          </div>
        ) : null}
        {images.length === 0 ? (
          <div
            style={{
              flex: 1,
              height: 180,
              borderRadius: "12px",
              backgroundColor: "#FEF2F2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GiftIllustration size={88} />
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", padding: "16px 60px 32px" }}>
        <span style={{ fontSize: "16px", fontWeight: 400, color: "#4A4A4A" }}>givftme.com</span>
      </div>
    </div>
  );
}

export async function GET(
  req: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;

  if (!isValidWishlistShareKey(token)) {
    return fallback(req, "invalid_token");
  }

  let result;
  try {
    result = await getWishlistOgData(token);
  } catch (error) {
    console.error("Wishlist OG lookup failed.", error);
    return fallback(req, "db_error");
  }

  if (result.kind !== "ok") {
    return fallback(req, result.kind);
  }

  const { data } = result;
  const [avatar, loadedImages] = await Promise.all([
    loadImageAsDataUrl(data.avatarUrl),
    Promise.all(data.imageUrls.map((url) => loadImageAsDataUrl(url))),
  ]);
  const images = loadedImages.filter((src): src is string => Boolean(src)).slice(0, GRID_SIZE);

  try {
    const fonts = await loadOgFonts(req.url);
    const response = await renderOgImage(
      <WishlistImage
        data={data}
        avatar={avatar}
        images={images}
        countdownLabel={getCountdownLabel(data.occasionDate)}
      />,
      fonts,
      OG_CACHE.wishlist,
    );

    trackEvent("og.wishlist_image.generated", {
      token,
      has_avatar: Boolean(avatar),
      item_count: data.availableCount,
    });

    return response;
  } catch (error) {
    console.error("Could not render wishlist OG image.", error);
    return fallback(req, "font_missing");
  }
}
