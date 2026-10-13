import type { Metadata } from "next";
import { NO_INDEX } from "@/lib/seo/metadata";

export const metadata: Metadata = { robots: NO_INDEX };

export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
