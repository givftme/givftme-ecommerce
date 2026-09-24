import { Skeleton } from "@/components/ui/Skeleton";

export default function WishlistsLoading() {
  return (
    <main className="min-h-dvh bg-surface px-4 py-6 sm:px-5 md:py-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-10 w-48 bg-stone-200/70" />
            <Skeleton className="h-4 w-56 bg-stone-200/70" />
          </div>
          <Skeleton className="h-10 w-36 rounded-full bg-stone-200/70" />
        </div>
        <Skeleton className="h-72 w-full rounded-3xl bg-white" />
        <Skeleton className="h-40 w-full rounded-3xl bg-white" />
      </div>
    </main>
  );
}
