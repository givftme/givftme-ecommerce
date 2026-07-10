"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/Button";

gsap.registerPlugin(useGSAP);

export function SuccessScreen() {
  const router = useRouter();
  const checkRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!checkRef.current) {
        return;
      }

      gsap.from(checkRef.current, {
        scale: 0,
        opacity: 0,
        duration: 0.5,
        ease: "back.out(2)",
      });
    },
    { scope: checkRef }
  );

  return (
    <AuthPageShell showBack={false} centered>
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center text-center">
        <div
          ref={checkRef}
          className="mb-7 flex h-28 w-28 items-center justify-center rounded-full bg-brand-light text-brand"
        >
          <CheckCircle className="h-20 w-20" strokeWidth={1.7} />
        </div>
        <h1 className="text-2xl font-bold text-ink">Successful</h1>
        <p className="mt-2 text-sm text-muted">
          Your password has been updated.
        </p>

        <div className="mt-auto w-full pb-8 pt-12">
          <Button
            type="button"
            fullWidth
            onClick={() => router.push("/auth/login")}
            className="h-12"
          >
            Done
          </Button>
        </div>
      </div>
    </AuthPageShell>
  );
}
