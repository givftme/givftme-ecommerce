"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

/**
 * Sends one admin mutation, toasts the outcome, and refreshes the server
 * component data on success. Resolves true when the request succeeded.
 */
export function useAdminRequest() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  const send = useCallback(async (
    url: string,
    init: { method: "PATCH" | "DELETE" | "POST"; body?: unknown },
    success: string,
  ) => {
    setPending(true);
    try {
      const response = await fetch(url, {
        method: init.method,
        headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast({ title: payload?.error || "Something went wrong. Try again.", variant: "danger" });
        return false;
      }
      toast({ title: success, variant: "success" });
      router.refresh();
      return true;
    } catch {
      toast({ title: "Couldn't reach the server. Check your connection.", variant: "danger" });
      return false;
    } finally {
      setPending(false);
    }
  }, [router, toast]);

  return { send, pending };
}
