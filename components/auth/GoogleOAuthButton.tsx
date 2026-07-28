"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { trackEvent } from "@/lib/analytics";
import { getSafeRedirect } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";

export function GoogleOAuthButton({
  label,
  flow,
  redirectTo,
  onError,
}: {
  label: string;
  flow: "signup" | "login";
  redirectTo?: string | null;
  onError?: (message: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleClick = () => {
    setIsConnecting(true);
    onError?.("");

    startTransition(async () => {
      const supabase = createClient();
      const callbackUrl = new URL("/callback", window.location.origin);
      const safeRedirect = getSafeRedirect(redirectTo, "");

      if (safeRedirect) {
        callbackUrl.searchParams.set("redirect", safeRedirect);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (error) {
        setIsConnecting(false);
        onError?.("Couldn't connect to Google. Please try again.");
        return;
      }

      trackEvent(`auth.${flow}.completed`, { method: "google" });
    });
  };

  const loading = isPending || isConnecting;

  return (
    <Button
      type="button"
      variant="ghost"
      fullWidth
      disabled={loading}
      onClick={handleClick}
      className="h-12"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- local static SVG icon, next/image blocks SVG optimization by default
        <img src="/icons/google.svg" alt="" width={20} height={20} aria-hidden />
      )}
      {loading ? "Connecting..." : label}
    </Button>
  );
}
