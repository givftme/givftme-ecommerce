/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */

import { trackEvent } from "@/lib/analytics";
import { clampPercent, formatContributorCount } from "@/lib/og/format";
import { loadImageAsDataUrl } from "@/lib/og/images";
import {
  defaultOgImageResponse,
  GiftIllustration,
  loadOgFonts,
  OG_CACHE,
  type OgFallbackReason,
  PartyIllustration,
  renderOgImage,
} from "@/lib/og/response";
import { getPoolPageData } from "@/lib/pools/server";
import { poolTokenSchema } from "@/lib/pools/validation";
import { formatPrice } from "@/lib/utils";
import { getDisplayName } from "@/lib/wishlist/display";

export const runtime = "edge";

function fallback(req: Request, reason: OgFallbackReason) {
  trackEvent("og.image.fallback_used", { route: "pool", reason });

  const transient = reason === "db_error" || reason === "font_missing";
  return defaultOgImageResponse(req.url, {
    status: reason === "invalid_token" ? 400 : 200,
    cacheControl: transient ? OG_CACHE.transientFailure : OG_CACHE.pool,
  });
}

type PoolImageProps = {
  title: string;
  receiverName: string;
  itemImage: string | null;
  amountRaised: number;
  targetAmount: number;
  contributorCount: number;
  isFullyFunded: boolean;
};

function PoolImage({
  title,
  receiverName,
  itemImage,
  amountRaised,
  targetAmount,
  contributorCount,
  isFullyFunded,
}: PoolImageProps) {
  const pct = clampPercent(amountRaised, targetAmount);

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

      <div style={{ display: "flex", flex: 1, alignItems: "center", padding: "40px 60px", gap: "48px" }}>
        {itemImage ? (
          <img
            src={itemImage}
            width={220}
            height={220}
            style={{ borderRadius: "16px", objectFit: "cover", boxShadow: "0 4px 24px rgba(0,0,0,0.12)" }}
          />
        ) : (
          <div
            style={{
              width: 220,
              height: 220,
              borderRadius: "16px",
              backgroundColor: "#FEF2F2",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingBottom: "36px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <GiftIllustration size={96} />
              <div style={{ display: "flex", marginLeft: "-18px" }}>
                <GiftIllustration size={64} />
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: "16px", minWidth: 0 }}>
          <div
            style={{
              display: "block",
              fontSize: "32px",
              fontWeight: 700,
              color: "#000000",
              lineHeight: 1.2,
              lineClamp: 2,
              overflow: "hidden",
            }}
          >
            {title}
          </div>
          <span style={{ fontSize: "20px", fontWeight: 400, color: "#4A4A4A" }}>For {receiverName}</span>

          {isFullyFunded ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                backgroundColor: "#DCFCE7",
                color: "#166534",
                padding: "10px 20px",
                borderRadius: "8px",
                fontSize: "22px",
                fontWeight: 700,
              }}
            >
              <PartyIllustration size={26} color="#166534" />
              Fully Funded!
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                width: "100%",
                height: "16px",
                backgroundColor: "#F7F7F7",
                borderRadius: "999px",
                overflow: "hidden",
              }}
            >
              <div style={{ width: `${pct}%`, height: "100%", backgroundColor: "#C50404", borderRadius: "999px" }} />
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "24px", fontWeight: 700, color: "#000000" }}>
              {`${formatPrice(amountRaised)} raised of ${formatPrice(targetAmount)}`}
            </span>
            <span style={{ fontSize: "18px", fontWeight: 400, color: "#4A4A4A" }}>
              {formatContributorCount(contributorCount)}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 60px 28px" }}>
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

  if (!poolTokenSchema.safeParse(token).success) {
    return fallback(req, "invalid_token");
  }

  let data;
  try {
    data = await getPoolPageData(token, null);
  } catch (error) {
    console.error("Pool OG lookup failed.", error);
    return fallback(req, "db_error");
  }

  if (!data) {
    return fallback(req, "not_found");
  }

  const { pool } = data;
  const isItemPool = Boolean(pool.wishlist_item_id);
  // A pool can reach its target a moment before its status flips (edge case 3).
  const isFullyFunded =
    pool.status === "fully_funded" || clampPercent(pool.amount_raised, pool.target_amount) >= 100;
  const itemImage = isItemPool ? await loadImageAsDataUrl(data.item?.image_url) : null;

  try {
    const fonts = await loadOgFonts(req.url);
    const response = await renderOgImage(
      <PoolImage
        title={pool.title}
        receiverName={getDisplayName(data.receiver.full_name)}
        itemImage={itemImage}
        amountRaised={pool.amount_raised}
        targetAmount={pool.target_amount}
        contributorCount={data.contributor_count}
        isFullyFunded={isFullyFunded}
      />,
      fonts,
      OG_CACHE.pool,
    );

    trackEvent("og.pool_image.generated", {
      token,
      pool_type: isItemPool ? "item" : "general",
      is_fully_funded: isFullyFunded,
    });

    return response;
  } catch (error) {
    console.error("Could not render pool OG image.", error);
    return fallback(req, "font_missing");
  }
}
