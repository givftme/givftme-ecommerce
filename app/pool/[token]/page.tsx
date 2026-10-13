import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { PoolPageClient } from "@/components/pools/PoolPageClient";
import { getPoolPageData } from "@/lib/pools/server";
import { poolTokenSchema } from "@/lib/pools/validation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { formatContributorCount } from "@/lib/og/format";
import { DEFAULT_OG_IMAGE, SITE_NAME, TWITTER_HANDLE } from "@/lib/seo/metadata";
import { formatPrice } from "@/lib/utils";
import { getDisplayName } from "@/lib/wishlist/display";

export const dynamic = "force-dynamic";

type PoolPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ contributed?: string; contribution_id?: string }>;
};

// Metadata is the same for every viewer, so it reads the pool anonymously.
const getPoolForMetadata = cache((token: string) => getPoolPageData(token, null));

export async function generateMetadata({
  params,
}: Pick<PoolPageProps, "params">): Promise<Metadata> {
  const { token } = await params;
  const fallback: Metadata = {
    title: "Gift Pool",
    openGraph: { siteName: SITE_NAME, type: "website", images: [DEFAULT_OG_IMAGE] },
  };

  if (!poolTokenSchema.safeParse(token).success) return fallback;

  let data;
  try {
    data = await getPoolForMetadata(token);
  } catch (error) {
    console.error("Could not build gift pool metadata.", error);
    return fallback;
  }
  if (!data) return fallback;

  const { pool } = data;
  const receiverName = getDisplayName(data.receiver.full_name);
  const progress = `${formatContributorCount(data.contributor_count)} ${formatPrice(pool.amount_raised)} of ${formatPrice(pool.target_amount)}`;
  const description = pool.wishlist_item_id && data.item
    ? `${progress} towards ${data.item.title}. Join the pool!`
    : `${progress} for ${receiverName}. Join the pool!`;
  const title = `${pool.title} — Gift Pool on ${SITE_NAME}`;
  const ogImageUrl = `/api/og/pool/${token}`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/pool/${token}` },
    openGraph: {
      title,
      description,
      url: `/pool/${token}`,
      siteName: SITE_NAME,
      type: "website",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: pool.title }],
    },
    twitter: {
      card: "summary_large_image",
      site: TWITTER_HANDLE,
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function PoolPage({ params, searchParams }: PoolPageProps) {
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
