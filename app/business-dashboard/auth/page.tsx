import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BizAuthScreen } from "@/components/business-dashboard/BizAuthScreen";
import { BUSINESS_DASHBOARD_PATH } from "@/lib/business-dashboard/auth";
import { getBusinessSession } from "@/lib/business-dashboard/queries";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  not_business: "That account isn't linked to a business. Sign in with your work account, or create a business account.",
};

export default async function BusinessAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; tab?: string; type?: string }>;
}) {
  const { member } = await getBusinessSession();
  if (member) redirect(BUSINESS_DASHBOARD_PATH);

  // `type=business` arrives from /get-started, so it opens on Create account.
  const { error, tab, type } = await searchParams;
  return (
    <BizAuthScreen
      initialTab={tab === "create" || type === "business" ? "create" : "signin"}
      initialError={error ? ERRORS[error] ?? null : null}
    />
  );
}
