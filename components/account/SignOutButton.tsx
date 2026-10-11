"use client";

import { useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/analytics";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";

export function SignOutButton() {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
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
      trackEvent("account.signed_out");
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
      <Button
        variant="text"
        onClick={() => { setError(null); setOpen(true); }}
        disabled={pending}
        aria-busy={pending}
        className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <LogOut aria-hidden="true" className="h-4 w-4" />
        {pending ? "Signing out…" : "Sign out"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out?</DialogTitle>
            <DialogDescription>You can sign back in whenever you need to.</DialogDescription>
          </DialogHeader>
          {error && <p role="alert" className="mt-4 text-sm text-brand">{error}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={() => void signOut()} disabled={pending}>
              {pending ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
