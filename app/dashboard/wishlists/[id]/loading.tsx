import { Skeleton } from "@/components/ui/Skeleton";

export default function WishlistDetailLoading() {
  return (
    <main className="min-h-dvh bg-surface pb-24 md:pb-10">
      <div className="mx-auto min-h-dvh max-w-4xl bg-white px-4 py-5 md:mt-6 md:min-h-0 md:rounded-2xl md:border md:border-stone-100 md:p-8 md:shadow-sm">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <div className="mt-6 flex items-center justify-between">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-11 w-32 rounded-full" />
        </div>
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </main>
  );
}
