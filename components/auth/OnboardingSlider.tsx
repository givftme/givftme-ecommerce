"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { withRedirect } from "@/lib/auth/redirect";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

export function OnboardingSlider({
  redirectTo,
}: {
  redirectTo?: string | null;
}) {
  const router = useRouter();
  const [activeSlide, setActiveSlide] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.localStorage.getItem("onboarded") === "true") {
      router.replace(withRedirect("/auth/welcome", redirectTo));
    }
  }, [redirectTo, router]);

  useGSAP(
    () => {
      if (!trackRef.current) {
        return;
      }

      gsap.to(trackRef.current, {
        x: `-${activeSlide * 100}%`,
        duration: 0.4,
        ease: "power2.inOut",
      });
    },
    { dependencies: [activeSlide], scope: trackRef }
  );

  const goToSlide = (slide: number) => {
    if (slide === 1) {
      window.localStorage.setItem("onboarded", "true");
    }

    setActiveSlide(slide);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) {
      return;
    }

    const distance = touchStartX.current - event.changedTouches[0].clientX;
    touchStartX.current = null;

    if (Math.abs(distance) < 40) {
      return;
    }

    if (distance > 0 && activeSlide === 0) {
      goToSlide(1);
    }

    if (distance < 0 && activeSlide === 1) {
      goToSlide(0);
    }
  };

  return (
    <main className="min-h-dvh overflow-hidden bg-white">
      <div
        className="mx-auto min-h-dvh max-w-[430px] overflow-hidden"
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0].clientX;
        }}
        onTouchEnd={handleTouchEnd}
      >
        <div ref={trackRef} className="flex min-h-dvh w-[200%]">
          <section className="flex min-h-dvh w-1/2 shrink-0 flex-col px-6 py-8">
            <div className="relative min-h-[52dvh] overflow-hidden rounded-b-[2rem] bg-surface">
              <Image
                src="/images/onboarding-1.jpg"
                alt="Warm Nigerian family celebration"
                fill
                sizes="(max-width: 768px) 100vw, 430px"
                className="object-cover"
                priority
              />
            </div>

            <div className="flex flex-1 flex-col justify-end pb-8 pt-8 text-center">
              <div className="mb-6 space-y-3">
                <h1 className="text-3xl font-bold leading-tight text-ink">
                  Simplifying Gift-Giving for all occasion
                </h1>
                <p className="mx-auto max-w-xs text-sm leading-6 text-muted">
                  for Birthday, Weddings, Anniversaries, and Festivities
                </p>
              </div>

              <div className="mb-6 flex justify-center gap-2">
                {[0, 1, 2].map((dot) => (
                  <button
                    key={dot}
                    type="button"
                    aria-label={`Go to onboarding slide ${dot + 1}`}
                    onClick={() => (dot < 2 ? goToSlide(dot) : undefined)}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      dot === activeSlide ? "w-8 bg-brand" : "w-2 bg-stone-300"
                    )}
                  />
                ))}
              </div>

              <Button
                type="button"
                size="lg"
                fullWidth
                onClick={() => goToSlide(1)}
                className="h-12"
              >
                Get Started
              </Button>

              <p className="mt-5 text-sm text-muted">
                Already have an account?{" "}
                <Link
                  href={withRedirect("/auth/login", redirectTo)}
                  className="font-semibold text-ink"
                >
                  Login here
                </Link>
              </p>
            </div>
          </section>

          <section className="relative flex min-h-dvh w-1/2 shrink-0 flex-col px-6 py-8">
            <button
              type="button"
              aria-label="Back to first slide"
              onClick={() => goToSlide(0)}
              className="mb-6 flex h-8 w-8 items-center justify-center rounded-full text-brand transition-colors hover:bg-brand-light"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="relative min-h-[46dvh] overflow-hidden rounded-b-[2rem] bg-surface">
              <Image
                src="/images/onboarding-2.jpg"
                alt="Warm Nigerian family photo"
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
                  className={cn(
                    buttonVariants({ fullWidth: true, size: "lg" }),
                    "h-12"
                  )}
                >
                  Login
                </Link>
                <Link
                  href={withRedirect("/auth/signup", redirectTo)}
                  className={cn(
                    buttonVariants({
                      variant: "ghost",
                      fullWidth: true,
                      size: "lg",
                    }),
                    "h-12"
                  )}
                >
                  Sign up
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
