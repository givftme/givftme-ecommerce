import { PageWrapper } from "@/components/layout/PageWrapper";
import { Skeleton } from "@/components/ui/Skeleton";

export default function OccasionsLoading() {
  return (
    <PageWrapper>
      <section className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
        <Skeleton className="h-10 w-64" />
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-72 rounded-2xl" />
          ))}
        </div>
      </section>
    </PageWrapper>
  );
}
