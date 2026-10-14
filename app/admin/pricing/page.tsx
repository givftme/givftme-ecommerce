import type { Metadata } from "next";
import { PricingControls } from "@/components/admin/PricingControls";
import { requireAdminPageUser } from "@/lib/admin/auth";
import { getPolicies } from "@/lib/pricing/server";
import { NO_INDEX } from "@/lib/seo/metadata";

export const metadata: Metadata = { title: "Pricing", robots: NO_INDEX };

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  await requireAdminPageUser();
  const initial = await getPolicies().catch(() => null);
  return <PricingControls initial={initial} />;
}
