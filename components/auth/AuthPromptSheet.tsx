"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/Button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import { withRedirect } from "@/lib/auth/redirect";
import { cn } from "@/lib/utils";

export function AuthPromptSheet({
  open,
  onOpenChange,
  redirectPath,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectPath?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const currentPath = redirectPath ?? `${pathname}${search ? `?${search}` : ""}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>You need an account</SheetTitle>
          <SheetDescription>
            Sign in to add gifts to your wishlist, buy for others, and more.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          <Link
            href={withRedirect("/login", currentPath)}
            className={cn(buttonVariants({ fullWidth: true }), "h-12")}
          >
            Log in
          </Link>
          <Link
            href={withRedirect("/signup", currentPath)}
            className={cn(
              buttonVariants({ variant: "ghost", fullWidth: true }),
              "h-12"
            )}
          >
            Create account
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
