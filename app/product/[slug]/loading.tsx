import { PageWrapper } from "@/components/layout/PageWrapper";
import { Skeleton } from "@/components/ui/Skeleton";

export default function ProductLoading() {
  return (
    <PageWrapper>
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-10 lg:grid-cols-2 lg:px-8">
        <div>
          <Skeleton className="aspect-square rounded-2xl" />
          <div className="mt-4 grid grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="aspect-square rounded-xl" />
            ))}
          </div>
        </div>
        <div className="space-y-5">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-12 rounded-full" />
          <Skeleton className="h-12 rounded-full" />
        </div>
      </section>
    </PageWrapper>
  );
}
