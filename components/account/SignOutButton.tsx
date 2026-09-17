"use client";

import { useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/analytics";

export function SignOutButton() {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function signOut() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || data.session) throw new Error("Session is still active.");
      trackEvent("auth.signed_out");
      // Discard the private router cache and shared layout after session removal.
      window.location.replace("/");
    } catch {
      setError("Couldn't sign out. Please try again.");
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div>
      <Button variant="text" onClick={signOut} disabled={pending} aria-busy={pending} className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <LogOut aria-hidden="true" className="h-4 w-4" />
        {pending ? "Signing out…" : "Sign out"}
      </Button>
      {error && <p role="alert" className="mt-2 text-sm text-brand">{error}</p>}
    </div>
  );
}
