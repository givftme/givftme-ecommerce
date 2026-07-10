"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function AuthAlert({
  message,
  tone = "error",
}: {
  message?: string | null;
  tone?: "error" | "success";
}) {
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null);

  if (!message || dismissedMessage === message) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
        tone === "success"
          ? "border-brand/20 bg-brand-light text-brand"
          : "border-brand/20 bg-brand-light text-brand"
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      <p>{message}</p>
      <button
        type="button"
        aria-label="Dismiss message"
        onClick={() => setDismissedMessage(message)}
        className="rounded-full p-0.5 transition-colors hover:bg-white/70"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
