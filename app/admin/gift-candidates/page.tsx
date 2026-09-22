import { GiftCandidateQueue } from "@/components/admin/GiftCandidateQueue";
import { requireAdminPageUser } from "@/lib/admin/auth";
import type { GiftMuseumCandidate } from "@/lib/gift-museum/types";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function GiftCandidatesAdminPage() {
  await requireAdminPageUser();
  const { data, error } = await createServiceClient()
    .from("gift_museum_candidates")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error("Could not load gift candidates.");
  }

  return (
    <GiftCandidateQueue
      initialCandidates={(data || []) as GiftMuseumCandidate[]}
    />
  );
}
