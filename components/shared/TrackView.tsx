"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export function TrackView({
  event,
  properties,
}: {
  event: string;
  properties?: Record<string, boolean | number | string | null | undefined>;
}) {
  useEffect(() => {
    trackEvent(event, properties);
  }, [event, properties]);

  return null;
}
