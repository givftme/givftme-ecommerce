import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { withRedirect } from "@/lib/auth/redirect";

interface EmptyCartProps {
  isAuthenticated: boolean;
}

export function EmptyCart({ isAuthenticated }: EmptyCartProps) {
  return (
    <section className="mx-auto flex max-w-sm flex-col items-center px-4 py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-light">
        <ShoppingCart className="h-10 w-10 text-brand" strokeWidth={1.75} />
      </div>
      <h1 className="mt-6 text-2xl font-bold text-ink">No items yet?</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        Continue shopping to explore more
      </p>
      <div className="mt-8 flex w-full flex-col gap-3">
        {!isAuthenticated ? (
          <Link
            href={withRedirect("/login", "/checkout")}
            className={buttonVariants({ fullWidth: true })}
          >
            Sign in
          </Link>
        ) : null}
        <Link
          href="/shop"
          className={cn(buttonVariants({ variant: "ghost", fullWidth: true }))}
        >
          Explore items
        </Link>
      </div>
    </section>
  );
}
