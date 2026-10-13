import type { Metadata } from "next";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { ToastProvider } from "@/components/ui/Toast";
import { ensureEvergreenWishlist, requireDashboardUser } from "@/lib/wishlist/server";
import { NO_INDEX } from "@/lib/seo/metadata";

export const metadata: Metadata = { title: "Dashboard", robots: NO_INDEX };

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user } = await requireDashboardUser();

  await ensureEvergreenWishlist(supabase, user.id);

  return (
    <ToastProvider>
      <div className="min-h-dvh bg-surface pb-20 md:pb-0">
        {children}
        <MobileBottomNav />
      </div>
    </ToastProvider>
  );
}
