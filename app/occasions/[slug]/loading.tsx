import { PageWrapper } from "@/components/layout/PageWrapper";
import { Skeleton } from "@/components/ui/Skeleton";

export default function OccasionLoading() {
  return (
    <PageWrapper>
      <Skeleton className="h-[40vh] min-h-[320px] rounded-none" />
      <section className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
        <Skeleton className="h-8 w-56" />
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-72 rounded-2xl" />
          ))}
        </div>
      </section>
    </PageWrapper>
  );
}
