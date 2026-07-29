import Link from "next/link";
import { CalendarHeart, ChevronDown, Plus } from "lucide-react";
import { OccasionCard } from "@/components/occasion/OccasionCard";
import { ReactivationPromptsBanner } from "@/components/occasion/ReactivationPromptsBanner";
import { buttonVariants } from "@/components/ui/Button";
import { WishlistCard } from "@/components/wishlist/WishlistCard";
import {
  getOccasionSummaries,
  getUnresolvedOccasionPrompts,
} from "@/lib/occasion/server";
import {
  ensureEvergreenWishlist,
  getWishlistSummaries,
  requireDashboardUser,
} from "@/lib/wishlist/server";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export default async function DashboardWishlistsPage() {
  const { supabase, user } = await requireDashboardUser();
  await ensureEvergreenWishlist(supabase, user.id);
  const wishlists = await getWishlistSummaries(supabase, user.id);
  const occasions = await getOccasionSummaries(supabase, user.id);
  const reactivationPrompts = await getUnresolvedOccasionPrompts(supabase, user.id);
  const evergreenSummary = wishlists.find((wishlist) => wishlist.type === "evergreen");
  const activeOccasions = occasions.filter((occasion) => occasion.status === "active");
  const pastOccasions = occasions.filter((occasion) => occasion.status === "archived");

  if (reactivationPrompts.length > 0) {
    trackEvent("occasion.reactivation_prompt.shown", {
      occasion_count: reactivationPrompts.length,
    });
  }

  return (
    <main className="min-h-dvh bg-surface px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink">My Wishlists</h1>
            <p className="mt-1 text-sm text-muted">Manage what you would love to receive.</p>
          </div>
          <Link
            href="/my-occasions/new"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-10")}
          >
            <Plus className="h-4 w-4" />
            Create occasion
          </Link>
        </header>

        {reactivationPrompts.length > 0 && (
          <ReactivationPromptsBanner prompts={reactivationPrompts} />
        )}

        {evergreenSummary && <WishlistCard wishlist={evergreenSummary} />}

        <section className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Occasions</h2>
            <Link
              href="/my-occasions/new"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-9 px-3")}
            >
              <Plus className="h-4 w-4" />
              New occasion
            </Link>
          </div>

          {occasions.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-surface px-4 py-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white">
                <CalendarHeart className="h-8 w-8 text-brand" strokeWidth={1.7} />
              </div>
              <p className="mx-auto mt-5 max-w-sm text-sm leading-6 text-muted">
                No occasions yet - create one for your next big moment
              </p>
              <Link
                href="/my-occasions/new"
                className={cn(buttonVariants({ variant: "filled", size: "md" }), "mt-5")}
              >
                <Plus className="h-4 w-4" />
                Create occasion
              </Link>
            </div>
          ) : (
            <>
              {activeOccasions.length === 0 ? (
                <p className="mt-5 text-sm text-muted">
                  No active occasions right now.
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  {activeOccasions.map((occasion, index) => (
                    <OccasionCard
                      key={occasion.id}
                      occasion={occasion}
                      index={index}
                    />
                  ))}
                </div>
              )}

              {pastOccasions.length > 0 && (
                <details className="group mt-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-1 py-2 text-sm font-medium text-muted hover:text-ink">
                    Past occasions ({pastOccasions.length})
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-3 space-y-3">
                    {pastOccasions.map((occasion, index) => (
                      <OccasionCard
                        key={occasion.id}
                        occasion={occasion}
                        index={index}
                      />
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
