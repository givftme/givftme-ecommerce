import { PageWrapper } from "@/components/layout/PageWrapper";
import { Skeleton } from "@/components/ui/Skeleton";

export default function CollectionLoading() {
  return (
    <PageWrapper>
      <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="mt-4 h-5 w-full max-w-xl" />
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="aspect-square rounded-2xl" />
          ))}
        </div>
      </section>
    </PageWrapper>
  );
}
