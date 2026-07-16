import { notFound } from "next/navigation";
import { OccasionDetailClient } from "@/components/occasion/OccasionDetailClient";
import { OCCASION_TYPES } from "@/lib/occasion/constants";
import { getOwnedOccasionDetail } from "@/lib/occasion/server";
import type { OccasionType } from "@/lib/occasion/types";
import { requireDashboardUser } from "@/lib/wishlist/server";

function parseCreatedType(value: string | string[] | undefined): OccasionType | undefined {
  const type = Array.isArray(value) ? value[0] : value;

  if (OCCASION_TYPES.includes(type as OccasionType)) {
    return type as OccasionType;
  }

  return undefined;
}

export default async function OccasionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string | string[]; type?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, user } = await requireDashboardUser();
  const detail = await getOwnedOccasionDetail(supabase, user.id, id);

  if (!detail) {
    notFound();
  }

  return (
    <OccasionDetailClient
      detail={detail}
      createdType={query.created ? parseCreatedType(query.type) : undefined}
    />
  );
}
