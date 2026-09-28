import { PricingControls } from "@/components/admin/PricingControls";
import { requireAdminPageUser } from "@/lib/admin/auth";
import { getPolicies } from "@/lib/pricing/server";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  await requireAdminPageUser();
  const initial = await getPolicies().catch(() => null);
  return <PricingControls initial={initial} />;
}
