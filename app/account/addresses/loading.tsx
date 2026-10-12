import { Skeleton } from "@/components/ui/Skeleton";

export default function AddressesLoading() {
  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-11 w-40 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[0, 1].map((item) => <Skeleton key={item} className="h-40 w-full rounded-2xl" />)}
      </div>
    </main>
  );
}
