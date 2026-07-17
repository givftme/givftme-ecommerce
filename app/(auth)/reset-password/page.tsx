import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/app/(auth)/reset-password/ResetPasswordForm";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/forgot-password");
  }

  return <ResetPasswordForm />;
}
