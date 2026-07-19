import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function ClaimedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500",
        className
      )}
    >
      Claimed
      <Check className="h-3 w-3" />
    </span>
  );
}
