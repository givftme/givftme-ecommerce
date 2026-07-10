"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

export function AuthPageShell({
  title,
  subtitle,
  children,
  backHref = "/auth/welcome",
  showBack = true,
  centered = false,
  className,
}: {
  title?: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  backHref?: string;
  showBack?: boolean;
  centered?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!contentRef.current) {
        return;
      }

      gsap.from(contentRef.current, {
        opacity: 0,
        y: 20,
        duration: 0.3,
        ease: "power2.out",
      });
    },
    { scope: contentRef }
  );

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(backHref);
  };

  return (
    <main className="min-h-dvh bg-white px-6 py-8">
      <div
        ref={contentRef}
        className={cn(
          "mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[430px] flex-col",
          centered && "justify-center",
          className
        )}
      >
        {showBack && (
          <button
            type="button"
            aria-label="Go back"
            onClick={handleBack}
            className="mb-7 flex h-8 w-8 items-center justify-center rounded-full text-brand transition-colors hover:bg-brand-light"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}

        {(title || subtitle) && (
          <header className="mb-7 space-y-1">
            {title && <h1 className="text-2xl font-bold text-ink">{title}</h1>}
            {subtitle && <p className="text-sm leading-5 text-muted">{subtitle}</p>}
          </header>
        )}

        {children}
      </div>
    </main>
  );
}
