import { redirect } from "next/navigation";
import { requireTeamMember } from "@/lib/admin/auth";
import { homePathForRole } from "@/lib/admin/roles";

export default async function AdminIndexPage() {
  const member = await requireTeamMember("/admin");
  redirect(homePathForRole(member.role));
}
