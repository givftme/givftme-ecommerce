"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";
import { withRedirect } from "@/lib/auth/redirect";
import { cn } from "@/lib/utils";

export function AuthWelcomePanel({
  redirectTo,
  onBack,
  showBack = true,
}: {
  redirectTo?: string | null;
  onBack?: () => void;
  showBack?: boolean;
}) {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
      {showBack && (
        <button
          type="button"
          aria-label="Go back"
          onClick={onBack}
          className="mb-6 flex h-8 w-8 items-center justify-center rounded-full text-brand transition-colors hover:bg-brand-light"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}

      <div className="relative min-h-[46dvh] overflow-hidden rounded-b-[2rem] bg-surface">
        <Image
          src="/images/onboarding-2.jpg"
          alt="Warm family celebration"
          fill
          sizes="(max-width: 768px) 100vw, 430px"
          className="object-cover"
          priority
        />
      </div>

      <div className="flex flex-1 flex-col justify-end pb-8 pt-8 text-center">
        <div className="mb-8 space-y-2">
          <h1 className="text-3xl font-bold text-ink">Welcome Home</h1>
          <p className="mx-auto max-w-xs text-sm leading-6 text-muted">
            for Birthday, Weddings, Anniversaries, and Festivities
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href={withRedirect("/auth/login", redirectTo)}
            className={cn(buttonVariants({ fullWidth: true, size: "lg" }), "h-12")}
          >
            Login
          </Link>
          <Link
            href={withRedirect("/auth/signup", redirectTo)}
            className={cn(
              buttonVariants({ variant: "ghost", fullWidth: true, size: "lg" }),
              "h-12"
            )}
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
