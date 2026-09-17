"use client";

import { Button } from "@/components/ui/Button";

export default function AccountError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="space-y-4 py-6">
      <h1 className="text-2xl font-bold text-ink">Couldn&apos;t load this page</h1>
      <p className="text-sm text-muted">Please try again in a moment.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
