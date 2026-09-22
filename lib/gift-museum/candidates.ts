import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { convertToNgn } from "@/lib/gift-museum/fx";
import { estimateMarkupPrice, normalizeCurrency } from "@/lib/gift-museum/pricing";
import type { GiftMuseumCandidate, ScrapeConfidence, ScrapeStatus } from "@/lib/gift-museum/types";
import {
  canonicalizeProductUrl,
  detectMerchant,
  hashCanonicalUrl,
  slugifyGiftTitle,
} from "@/lib/gift-museum/url";
import type { ProductCardData } from "@/lib/sanity/types";

export interface CandidateSourceInput {
  userId: string;
  wishlistItemId?: string;
  originalUrl: string;
  title?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  sourcePrice?: number | null;
  sourceCurrency?: string | null;
  scrapeStatus?: ScrapeStatus;
  scrapeConfidence?: ScrapeConfidence;
}

function shouldRefreshCandidate(existing: GiftMuseumCandidate) {
  return existing.status === "pending" || existing.status === "needs_edit";
}

function buildCandidateProduct(candidate: GiftMuseumCandidate): ProductCardData {
  const price = candidate.admin_price_ngn ?? candidate.recommended_price_ngn ?? candidate.converted_price_ngn;

  return {
    id: candidate.id,
    catalogProductId: candidate.id,
    slug: candidate.public_slug,
    title: candidate.title,
    subtitle: candidate.merchant_label || "Fetched gift",
    imageUrl: candidate.image_url,
    price,
    compareAtPrice: null,
    supplierProductId: null,
    hasVariants: false,
    createdAt: candidate.published_at || candidate.created_at,
    occasionTypes: [],
    isNew: false,
    isOnFlashSale: false,
    saleEndTime: null,
    fulfilmentMode: "external_redirect",
    externalUrl: candidate.canonical_url,
    sourceCurrency: candidate.source_currency,
    sourcePrice: candidate.source_price,
  };
}

export function candidateToProductCard(candidate: GiftMuseumCandidate) {
  return buildCandidateProduct(candidate);
}

export async function upsertGiftMuseumCandidateForWishlistItem(
  input: CandidateSourceInput
) {
  const serviceSupabase = createServiceClient();
  const canonicalUrl = canonicalizeProductUrl(input.originalUrl);
  const urlHash = hashCanonicalUrl(canonicalUrl);
  const merchant = detectMerchant(canonicalUrl);
  const sourcePrice = input.sourcePrice ?? null;
  const sourceCurrency = normalizeCurrency(input.sourceCurrency);
  let conversion = null;

  try {
    conversion = await convertToNgn(serviceSupabase, sourcePrice, sourceCurrency);
  } catch (error) {
    console.error("Gift candidate FX conversion failed.", error);
  }

  const markup = estimateMarkupPrice(
    sourcePrice,
    conversion?.convertedPriceNgn ?? null
  );
  const title = input.title?.trim() || "Untitled gift";
  const existing = await serviceSupabase
    .from("gift_museum_candidates")
    .select("*")
    .eq("canonical_url_hash", urlHash)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  let candidate: GiftMuseumCandidate | null = null;

  if (existing.data) {
    const existingCandidate = existing.data as GiftMuseumCandidate;
    const refresh = shouldRefreshCandidate(existingCandidate);
    const updatePayload = {
      demand_count: existingCandidate.demand_count + 1,
      original_url: input.originalUrl,
      merchant: merchant.key,
      merchant_label: merchant.label,
      title: refresh && title !== "Untitled gift" ? title : existingCandidate.title,
      image_url:
        refresh && input.imageUrl
          ? input.imageUrl
          : existingCandidate.image_url,
      description:
        refresh && input.description
          ? input.description
          : existingCandidate.description,
      source_price:
        refresh && sourcePrice !== null
          ? sourcePrice
          : existingCandidate.source_price,
      source_currency:
        refresh && sourceCurrency
          ? sourceCurrency
          : existingCandidate.source_currency,
      converted_price_ngn:
        refresh && conversion?.convertedPriceNgn != null
          ? conversion.convertedPriceNgn
          : existingCandidate.converted_price_ngn,
      fx_rate:
        refresh && conversion?.rate != null
          ? conversion.rate
          : existingCandidate.fx_rate,
      fx_rate_source:
        refresh && conversion?.source
          ? conversion.source
          : existingCandidate.fx_rate_source,
      fx_as_of:
        refresh && conversion?.asOf
          ? conversion.asOf
          : existingCandidate.fx_as_of,
      markup_percent: refresh ? markup.markupPercent : existingCandidate.markup_percent,
      delivery_buffer_ngn: refresh
        ? markup.deliveryBufferNgn
        : existingCandidate.delivery_buffer_ngn,
      rounding_ngn: refresh ? markup.roundingNgn : existingCandidate.rounding_ngn,
      recommended_price_ngn:
        refresh && markup.recommendedPriceNgn != null
          ? markup.recommendedPriceNgn
          : existingCandidate.recommended_price_ngn,
      scrape_status: input.scrapeStatus || existingCandidate.scrape_status,
      scrape_confidence:
        input.scrapeConfidence || existingCandidate.scrape_confidence,
    };

    const updated = await serviceSupabase
      .from("gift_museum_candidates")
      .update(updatePayload)
      .eq("id", existingCandidate.id)
      .select("*")
      .single();

    if (updated.error) {
      throw updated.error;
    }

    candidate = updated.data as GiftMuseumCandidate;
  } else {
    const inserted = await serviceSupabase
      .from("gift_museum_candidates")
      .insert({
        original_url: input.originalUrl,
        canonical_url: canonicalUrl,
        canonical_url_hash: urlHash,
        public_slug: slugifyGiftTitle(title, urlHash),
        merchant: merchant.key,
        merchant_label: merchant.label,
        title,
        image_url: input.imageUrl || null,
        description: input.description || null,
        source_price: sourcePrice,
        source_currency: sourceCurrency,
        converted_price_ngn: conversion?.convertedPriceNgn ?? null,
        fx_rate: conversion?.rate ?? null,
        fx_rate_source: conversion?.source ?? null,
        fx_as_of: conversion?.asOf ?? null,
        markup_percent: markup.markupPercent,
        delivery_buffer_ngn: markup.deliveryBufferNgn,
        rounding_ngn: markup.roundingNgn,
        recommended_price_ngn: markup.recommendedPriceNgn,
        scrape_status: input.scrapeStatus || (input.title ? "fetched" : "manual"),
        scrape_confidence: input.scrapeConfidence || (input.title ? "medium" : "low"),
        created_by: input.userId,
      })
      .select("*")
      .single();

    if (inserted.error) {
      throw inserted.error;
    }

    candidate = inserted.data as GiftMuseumCandidate;
  }

  if (candidate && input.wishlistItemId) {
    const link = await serviceSupabase
      .from("gift_museum_candidate_wishlist_items")
      .upsert(
        {
          candidate_id: candidate.id,
          wishlist_item_id: input.wishlistItemId,
        },
        { onConflict: "candidate_id,wishlist_item_id" }
      );

    if (link.error) {
      console.error("Gift candidate wishlist link failed.", link.error);
    }
  }

  return candidate;
}

export async function listPublishedExternalCandidateProducts(
  supabase: SupabaseClient,
  limit: number,
  offset = 0
) {
  const { data, error } = await supabase
    .from("gift_museum_candidates")
    .select("*")
    .eq("status", "published")
    .eq("publish_mode", "external_redirect")
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Could not load published external candidates.", error);
    return [];
  }

  return (data as GiftMuseumCandidate[]).map(buildCandidateProduct);
}

export async function countPublishedExternalCandidates(supabase: SupabaseClient) {
  const { count, error } = await supabase
    .from("gift_museum_candidates")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .eq("publish_mode", "external_redirect");

  if (error) {
    console.error("Could not count published external candidates.", error);
    return 0;
  }

  return count || 0;
}

export async function getPublishedExternalCandidateBySlug(
  supabase: SupabaseClient,
  slug: string
) {
  const { data, error } = await supabase
    .from("gift_museum_candidates")
    .select("*")
    .eq("status", "published")
    .eq("publish_mode", "external_redirect")
    .eq("public_slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Could not load external candidate product.", error);
    return null;
  }

  return data ? (data as GiftMuseumCandidate) : null;
}
