import { redirect } from "next/navigation";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { withRedirect } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/app/account/profile/ProfileForm";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(withRedirect("/login", "/account/profile"));
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("id, full_name, avatar_url, phone, default_thank_you_msg")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (
    <PageWrapper isAuthenticated>
      <section className="bg-surface py-10">
        <div className="mx-auto max-w-2xl px-4 md:px-6">
          <h1 className="text-3xl font-bold text-ink">Profile</h1>
          <p className="mt-2 text-sm text-muted">
            Update how you appear to others and manage your account.
          </p>

          <div className="mt-8">
            <ProfileForm
              userId={user.id}
              email={user.email ?? ""}
              fullName={profile?.full_name ?? null}
              avatarUrl={profile?.avatar_url ?? null}
              phone={profile?.phone ?? null}
              defaultThankYouMsg={profile?.default_thank_you_msg ?? null}
            />
          </div>
        </div>
      </section>
    </PageWrapper>
  );
}
