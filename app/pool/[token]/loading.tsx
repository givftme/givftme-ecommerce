export default function PoolLoading() {
  return (
    <div className="min-h-dvh bg-surface px-4 py-8 sm:py-12" aria-label="Loading gift pool" role="status">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="animate-pulse rounded-2xl bg-card p-6 shadow-sm motion-reduce:animate-none">
          <div className="h-3 w-28 rounded bg-surface" />
          <div className="mt-4 h-9 w-3/4 rounded bg-surface" />
          <div className="mt-3 h-4 w-1/2 rounded bg-surface" />
        </div>
        <div className="animate-pulse rounded-2xl bg-card p-6 shadow-sm motion-reduce:animate-none">
          <div className="mx-auto h-44 w-44 rounded-full border-[10px] border-line" />
          <div className="mt-5 h-3 w-full rounded bg-surface" />
          <div className="mt-4 h-4 w-40 rounded bg-surface" />
        </div>
        <div className="animate-pulse rounded-2xl bg-card p-6 shadow-sm motion-reduce:animate-none">
          <div className="h-5 w-32 rounded bg-surface" />
          <div className="mt-4 h-11 w-full rounded-full bg-surface" />
        </div>
      </div>
      <span className="sr-only">Loading gift pool details</span>
    </div>
  );
}
