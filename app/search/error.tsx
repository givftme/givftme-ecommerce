"use client";

import { Button } from "@/components/ui/Button";

export default function SearchError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-ink">Could not load products.</h1>
      <p className="mt-3 text-sm text-muted">Try refreshing.</p>
      <Button type="button" className="mt-6" onClick={reset}>
        Refresh
      </Button>
    </main>
  );
}
