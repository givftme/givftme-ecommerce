import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function ClaimedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted",
        className
      )}
    >
      Claimed
      <Check className="h-3 w-3" />
    </span>
  );
}
