import { Skeleton } from "@/components/ui/Skeleton";

export default function OrdersLoading() {
  return (
    <main className="mx-auto max-w-[800px] space-y-6">
      <div><Skeleton className="h-9 w-40" /><Skeleton className="mt-3 h-5 w-72" /></div>
      <div className="flex gap-5 border-b border-stone-200 pb-3">
        {[0, 1, 2].map((item) => <Skeleton key={item} className="h-7 w-24" />)}
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((item) => <Skeleton key={item} className="h-44 w-full rounded-2xl" />)}
      </div>
    </main>
  );
}
