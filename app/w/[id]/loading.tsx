import { Skeleton } from "@/components/ui/Skeleton";

export default function SharedWishlistLoading() {
  return (
    <main className="min-h-dvh bg-surface pb-10">
      <div className="bg-brand px-4 pb-6 pt-8 md:hidden">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full bg-white/20" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-24 bg-white/20" />
            <Skeleton className="h-6 w-40 bg-white/20" />
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6 lg:px-8">
        <div className="md:grid md:grid-cols-[18rem_1fr] md:gap-6 lg:grid-cols-[20rem_1fr]">
          <aside className="hidden md:block">
            <Skeleton className="h-64 rounded-2xl" />
          </aside>
          <section className="space-y-3 md:rounded-2xl md:border md:border-stone-100 md:bg-white md:p-5">
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28 rounded-full" />
              <Skeleton className="h-9 w-32 rounded-full" />
              <Skeleton className="h-9 w-28 rounded-full" />
            </div>
            <div className="grid max-w-[680px] grid-cols-1 gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-28 rounded-2xl" />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
