"use client";

import Link from "next/link";
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

export function AuthGateSheet({
  open,
  onOpenChange,
  redirectPath,
  receiverName,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectPath: string;
  receiverName?: string;
  description?: string;
}) {
  const sheetDescription =
    description ||
    `Sign in to buy gifts and let ${receiverName || "the receiver"} know it's coming.`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>You need an account</SheetTitle>
          <SheetDescription>{sheetDescription}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          <Link
            href={withRedirect("/login", redirectPath)}
            className={cn(buttonVariants({ fullWidth: true }), "h-12")}
          >
            Log in
          </Link>
          <Link
            href={withRedirect("/signup", redirectPath)}
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
