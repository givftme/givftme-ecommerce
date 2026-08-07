"use client";

import { ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export function TrackingLink({
  href,
  carrierName,
  orderId,
}: {
  href: string;
  carrierName: string | null;
  orderId: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent("order.tracking_link_clicked", { order_id: orderId })}
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
    >
      Track on {carrierName || "carrier"}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}
