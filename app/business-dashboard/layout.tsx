import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NO_INDEX } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  title: { default: "Business dashboard", template: "%s — Givftme for Business" },
  robots: NO_INDEX,
};

export const dynamic = "force-dynamic";

// The auth guard runs before this renders: proxy.ts sends visitors without a
// business account (users.account_type) to /business-dashboard/auth, and the
// dashboard page then checks business_users membership itself. Fonts come
// from the root layout.
export default function BusinessDashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
