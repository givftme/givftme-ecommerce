"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { getSafeRedirect } from "@/lib/auth/redirect";

export function GoogleOAuthButton({
  label,
  redirectTo,
  onError,
}: {
  label: string;
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
      }
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
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-base font-semibold text-brand">
          G
        </span>
      )}
      {loading ? "Connecting..." : label}
    </Button>
  );
}
