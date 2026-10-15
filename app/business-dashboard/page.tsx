import { redirect } from "next/navigation";
import { BizDashShell } from "@/components/business-dashboard/BizDashShell";
import { BUSINESS_AUTH_PATH } from "@/lib/business-dashboard/auth";
import { getBusinessSession, loadBusinessDashboard } from "@/lib/business-dashboard/queries";
import { lagosToday, toIsoDate } from "@/lib/business-dashboard/utils";

// One shell for every view; the views switch client-side without a URL change.
export default async function BusinessDashboardPage() {
  const { user, member } = await getBusinessSession();
  if (!user) redirect(BUSINESS_AUTH_PATH);
  if (!member) redirect(`${BUSINESS_AUTH_PATH}?error=not_business`);

  const data = await loadBusinessDashboard(member);
  return <BizDashShell data={data} todayIso={toIsoDate(lagosToday())} />;
}
