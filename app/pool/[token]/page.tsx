import { notFound } from "next/navigation";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { PoolPageClient } from "@/components/pools/PoolPageClient";
import { getPoolPageData } from "@/lib/pools/server";
import { poolTokenSchema } from "@/lib/pools/validation";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PoolPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ contributed?: string; contribution_id?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  if (!poolTokenSchema.safeParse(token).success) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let data;
  try {
    data = await getPoolPageData(token, user?.id ?? null);
  } catch (error) {
    console.error("Could not render group gift pool.", error);
    notFound();
  }
  if (!data) notFound();

  let contributionReturn: {
    status: "paid" | "pending_payment" | "failed" | null;
    amount: number | null;
    accepted: boolean;
    refundRequired: boolean;
  } = { status: null, amount: null, accepted: false, refundRequired: false };

  if (query.contributed === "true" && query.contribution_id && user) {
    const service = createServiceClient();
    const { data: contribution } = await service.from("pool_contributions")
      .select("amount, status, applied_to_pool")
      .eq("id", query.contribution_id)
      .eq("pool_id", data.pool.id)
      .eq("contributor_id", user.id)
      .maybeSingle();

    if (contribution) {
      contributionReturn = {
        status: contribution.status as "paid" | "pending_payment" | "failed",
        amount: Number(contribution.amount),
        accepted: contribution.status === "paid" && contribution.applied_to_pool === true,
        refundRequired: contribution.status === "paid" && contribution.applied_to_pool === false,
      };
    }
  }

  return (
    <PageWrapper isAuthenticated={Boolean(user)}>
      <PoolPageClient
        initialData={data}
        isAuthenticated={Boolean(user)}
        contributionReturn={contributionReturn}
      />
    </PageWrapper>
  );
}
