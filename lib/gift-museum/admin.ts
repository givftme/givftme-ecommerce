import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSanityWriteClient } from "@/lib/sanity/write";
import type { GiftMuseumCandidate } from "@/lib/gift-museum/types";

export const candidateUpdateSchema = z.object({
  status: z
    .enum(["pending", "approved", "published", "rejected", "needs_edit"])
    .optional(),
  publish_mode: z.enum(["external_redirect", "catalog_checkout"]).optional(),
  admin_notes: z.string().max(2000).nullable().optional(),
  admin_price_ngn: z.number().int().nonnegative().nullable().optional(),
  recommended_price_ngn: z.number().int().nonnegative().nullable().optional(),
  markup_percent: z.number().min(0).max(500).optional(),
  delivery_buffer_ngn: z.number().int().nonnegative().optional(),
  rounding_ngn: z.number().int().positive().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  image_url: z.string().url().nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
});

export type CandidateUpdateInput = z.infer<typeof candidateUpdateSchema>;

export async function updateCandidateForAdmin(
  supabase: SupabaseClient,
  id: string,
  reviewerId: string,
  input: CandidateUpdateInput
) {
  const payload = {
    ...input,
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("gift_museum_candidates")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as GiftMuseumCandidate;
}

async function publishCatalogCandidate(
  candidate: GiftMuseumCandidate
) {
  const client = createSanityWriteClient();
  const price =
    candidate.admin_price_ngn ??
    candidate.recommended_price_ngn ??
    candidate.converted_price_ngn;

  if (typeof price !== "number") {
    throw new Error("Set a final NGN price before promoting to catalog checkout.");
  }

  const sanityId = candidate.linked_sanity_product_id || `gift-candidate-${candidate.id}`;
  const document = {
    _id: sanityId,
    _type: "product",
    title: candidate.title,
    slug: { _type: "slug", current: candidate.public_slug },
    status: "draft",
    featured: false,
    shortDescription:
      candidate.description ||
      `Fetched from ${candidate.merchant_label || candidate.merchant}. Confirm supplier and availability before activating.`,
    category: "Fetched gifts",
    tags: ["fetched", candidate.merchant].filter(Boolean),
    supplierProductId: candidate.canonical_url,
    estimatedDeliveryDays: "Confirm before activation",
    hasVariants: false,
    basePrice: price,
  };

  await client.createOrReplace(document);

  return sanityId;
}

export async function publishCandidate(
  supabase: SupabaseClient,
  id: string,
  reviewerId: string
) {
  const { data, error } = await supabase
    .from("gift_museum_candidates")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    throw error || new Error("Candidate not found.");
  }

  const candidate = data as GiftMuseumCandidate;

  if (candidate.status === "published") {
    return candidate;
  }

  if (candidate.status !== "approved") {
    throw new Error("Approve the candidate before publishing.");
  }

  let linkedSanityProductId = candidate.linked_sanity_product_id;

  if (candidate.publish_mode === "catalog_checkout") {
    linkedSanityProductId = await publishCatalogCandidate(candidate);
  }

  const { data: updated, error: updateError } = await supabase
    .from("gift_museum_candidates")
    .update({
      status: "published",
      linked_sanity_product_id: linkedSanityProductId,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      published_at: candidate.published_at || new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) {
    throw updateError;
  }

  return updated as GiftMuseumCandidate;
}
