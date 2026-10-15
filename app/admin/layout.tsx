import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { ToastProvider } from "@/components/ui/Toast";
import { requireTeamMember } from "@/lib/admin/auth";
import { NO_INDEX } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s — Givftme Admin" },
  robots: NO_INDEX,
};

export const dynamic = "force-dynamic";

// Every /admin page: a team role is required here, and each page then checks
// its own screen against the permission matrix (lib/admin/roles.ts).
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const member = await requireTeamMember("/admin");
  return (
    <ToastProvider>
      <AdminShell member={{ fullName: member.fullName, email: member.email, role: member.role }}>
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
