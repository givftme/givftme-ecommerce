import { GiftsClient } from "@/components/gifts/GiftsClient";
import { getGiftsReceived } from "@/lib/thank-you/server";
import { requireDashboardUser } from "@/lib/wishlist/server";

export default async function GiftsPage() {
  const { supabase, user } = await requireDashboardUser();
  const [gifts, { data: profile }] = await Promise.all([
    getGiftsReceived(supabase, user.id),
    supabase.from("users").select("default_thank_you_msg").eq("id", user.id).maybeSingle(),
  ]);

  return (
    <main className="min-h-dvh bg-surface px-4 py-6">
      <div className="mx-auto max-w-4xl">
        <GiftsClient
          initialGifts={gifts}
          defaultThankYouMessage={
            (profile as { default_thank_you_msg?: string | null } | null)?.default_thank_you_msg ||
            ""
          }
        />
      </div>
    </main>
  );
}
