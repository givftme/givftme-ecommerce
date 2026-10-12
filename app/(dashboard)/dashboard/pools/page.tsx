import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { getDashboardPools } from "@/lib/pools/server";
import { trackEvent } from "@/lib/analytics";
import { requireDashboardUser } from "@/lib/wishlist/server";
import { cn, formatPrice } from "@/lib/utils";

function PoolCard({ pool }: { pool: Awaited<ReturnType<typeof getDashboardPools>>["active"][number] }) {
  const percent = pool.target_amount > 0
    ? Math.min(100, Math.round((pool.amount_raised / pool.target_amount) * 100))
    : 0;
  const statusLabel = pool.status.replaceAll("_", " ");

  return (
    <article className="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-5">
      {pool.status === "fully_funded" && (
        <div className="mb-4 rounded-xl bg-brand-light px-3 py-2 text-sm font-medium text-brand">
          🎉 {pool.title} is fully funded! <Link href={`/pool/${pool.token}`} className="underline">View pool →</Link>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-ink">{pool.title}</h2>
            <Badge variant={pool.status === "fully_funded" ? "success" : undefined}>{statusLabel}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {pool.item_title ? `For ${pool.item_title}` : `Gift fund for ${pool.receiver_name}`}
            {pool.created_by !== pool.receiver_id ? ` · Organised by ${pool.creator_name}` : ""}
          </p>
        </div>
        <Link href={`/pool/${pool.token}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "shrink-0")}>
          View pool
        </Link>
      </div>
      <div className="mt-5">
        <div className="flex justify-between gap-3 text-sm">
          <span className="font-semibold text-ink">{formatPrice(pool.amount_raised)} raised</span>
          <span className="text-muted">of {formatPrice(pool.target_amount)}</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-brand-light" role="progressbar" aria-label={`${pool.title} funding progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted">{pool.contributor_count} contributors · {percent}% funded</p>
      </div>
    </article>
  );
}

export default async function DashboardPoolsPage() {
  const { user } = await requireDashboardUser("/dashboard/pools");
  const pools = await getDashboardPools(user.id);
  trackEvent("dashboard.pools.viewed", {
    active_count: pools.active.length,
    past_count: pools.past.length,
  });

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 md:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink sm:text-4xl">Gift pools</h1>
          <p className="mt-2 text-sm text-muted">Follow the gifts you organised or the pools created for you.</p>
        </div>
        <Link href="/wishlists" className={cn(buttonVariants(), "shrink-0")}>Create a gift pool</Link>
      </div>

      <section className="mt-8 space-y-3" aria-labelledby="active-pools-heading">
        <h2 id="active-pools-heading" className="text-lg font-semibold text-ink">Active pools</h2>
        {pools.active.length > 0 ? (
          pools.active.map((pool) => <PoolCard key={pool.id} pool={pool} />)
        ) : (
          <div className="rounded-2xl border border-line bg-card px-5 py-10 text-center shadow-sm">
            <h3 className="text-base font-semibold text-ink">No active gift pools</h3>
            <p className="mt-2 text-sm text-muted">Create one for an upcoming occasion.</p>
            <Link href="/wishlists" className={cn(buttonVariants(), "mt-5")}>Go to my wishlists</Link>
          </div>
        )}
      </section>

      {pools.past.length > 0 && (
        <section className="mt-9 space-y-3" aria-labelledby="past-pools-heading">
          <h2 id="past-pools-heading" className="text-lg font-semibold text-ink">Past pools</h2>
          {pools.past.map((pool) => <PoolCard key={pool.id} pool={pool} />)}
        </section>
      )}
    </div>
  );
}
