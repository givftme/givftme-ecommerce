import { Skeleton } from "@/components/ui/Skeleton";

export default function WishlistDetailLoading() {
  return (
    <main className="min-h-dvh bg-surface pb-24 md:pb-10">
      <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-4 sm:px-5 md:py-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-6">
        <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-1">
          <Skeleton className="h-10 w-36 rounded-full bg-stone-200/70" />
          <Skeleton className="h-52.5 w-full rounded-3xl sm:h-57.5 sm:rounded-[30px] bg-white" />
        </div>
        <div className="flex flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Skeleton className="h-64 w-full rounded-3xl bg-white" />
          <Skeleton className="h-28 w-full rounded-3xl bg-white" />
        </div>
        <div className="flex flex-col gap-2.5 lg:col-start-1 lg:row-start-2">
          <Skeleton className="mb-0.5 h-8 w-40 bg-stone-200/70" />
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-23 w-full rounded-[22px] bg-white sm:h-25.5" />
          ))}
        </div>
      </div>
    </main>
  );
}
