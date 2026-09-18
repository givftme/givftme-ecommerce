"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

// Without this boundary an uncaught render error anywhere under /w reaches
// Next's built-in global error screen, which carries none of the product's
// voice and gives the giver no way back to the wishlist.
export default function SharedWishlistError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Shared wishlist route failed.", error);
  }, [error]);

  return (
    <main
      role="alert"
      className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center"
    >
      <h1 className="text-xl font-bold text-ink">
        We couldn&apos;t load this gift.
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Something went wrong on our side, not yours. Try again in a moment.
      </p>
      <Button type="button" className="mt-6" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
