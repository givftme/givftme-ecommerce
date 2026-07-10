"use client";

import { useRouter } from "next/navigation";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { AuthWelcomePanel } from "@/components/auth/AuthWelcomePanel";
import { withRedirect } from "@/lib/auth/redirect";

export function WelcomeScreen({ redirectTo }: { redirectTo?: string | null }) {
  const router = useRouter();

  return (
    <AuthPageShell showBack={false}>
      <AuthWelcomePanel
        redirectTo={redirectTo}
        onBack={() => router.push(withRedirect("/auth/onboarding", redirectTo))}
      />
    </AuthPageShell>
  );
}
